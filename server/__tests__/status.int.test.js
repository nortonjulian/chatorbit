/**
 * @jest-environment node
 */
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import prisma from '../utils/prismaClient.js';

process.env.NODE_ENV = 'test';
process.env.STATUS_ENABLED = 'true';
process.env.DEV_FALLBACKS = 'true';

// Import the real router
const { default: statusRouter } = await import('../routes/status.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  // emulate the X-Requested-With CSRF guard
  app.use((req, _res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
      req.headers['x-requested-with'] =
        req.headers['x-requested-with'] || 'XMLHttpRequest';
    }
    next();
  });
  // inject a simple test user from header
  app.use((req, _res, next) => {
    const headerId = req.headers['x-test-user-id'];
    if (headerId) req.user = { id: Number(headerId), role: 'USER', plan: 'FREE' };
    next();
  });
  const upload = multer(); // match prod shape
  app.use('/status', statusRouter);
  app.get('/health', (_req, res) => res.json({ ok: true }));
  return app;
}

function expectStatus(res, code) {
  if (res.status !== code) {
    throw new Error(`Expected ${code}, got ${res.status}. Body=${JSON.stringify(res.body)}`);
  }
}

describe('Status API (integration, router-mounted)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await prisma.statusReaction.deleteMany({});
    await prisma.statusView.deleteMany({});
    await prisma.statusKey.deleteMany({});
    await prisma.statusAsset.deleteMany({});
    await prisma.status.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.user.createMany({
      data: [
        { id: 1, username: 'tester',  email: 'tester@example.com',  password: 'x', role: 'USER', plan: 'FREE' },
        { id: 2, username: 'viewer2', email: 'viewer2@example.com', password: 'x', role: 'USER', plan: 'FREE' },
      ],
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    await prisma.statusReaction.deleteMany({});
    await prisma.statusView.deleteMany({});
    await prisma.statusKey.deleteMany({});
    await prisma.statusAsset.deleteMany({});
    await prisma.status.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  it('health works (smoke)', async () => {
    const res = await request(app).get('/health');
    expectStatus(res, 200);
    expect(res.body).toEqual({ ok: true });
  });

  it('POST /status (CUSTOM [self]) → 201; GET /status/feed includes it', async () => {
    const create = await request(app)
      .post('/status')
      .set('X-Test-User-Id', '1')
      .set('Content-Type', 'application/json')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ caption: 'custom for me only', audience: 'CUSTOM', customAudienceIds: [1] });
    expectStatus(create, 201);
    const createdId = create.body.id;

    const feed = await request(app)
      .get('/status/feed?limit=10')
      .set('X-Test-User-Id', '1');
    expectStatus(feed, 200);

    const item = (feed.body.items || []).find(i => i.id === createdId);
    expect(item).toBeTruthy();
    expect(item.encryptedKeyForMe).toBeTruthy();
  });

  it('PATCH /status/:id/view twice → 204 then 200/204 (idempotent)', async () => {
    const created = await request(app)
      .post('/status')
      .set('X-Test-User-Id', '1')
      .set('Content-Type', 'application/json')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ caption: 'view me', audience: 'CUSTOM', customAudienceIds: [1] });
    expectStatus(created, 201);
    const id = created.body.id;

    const first = await request(app)
      .patch(`/status/${id}/view`)
      .set('X-Test-User-Id', '1')
      .set('X-Requested-With', 'XMLHttpRequest');
    expectStatus(first, 204);

    const second = await request(app)
      .patch(`/status/${id}/view`)
      .set('X-Test-User-Id', '1')
      .set('X-Requested-With', 'XMLHttpRequest');
    expect([200, 204]).toContain(second.status);
  });

  it('POST /status/:id/reactions twice → {op:"added"} then {op:"removed"}', async () => {
    // Create a guaranteed-accessible CUSTOM(self) status
    const created = await request(app)
      .post('/status')
      .set('X-Test-User-Id', '1')
      .set('Content-Type', 'application/json')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ caption: 'react to me', audience: 'CUSTOM', customAudienceIds: [1] });
    expectStatus(created, 201);
    const id = created.body.id;

    const add = await request(app)
      .post(`/status/${id}/reactions`)
      .set('X-Test-User-Id', '1')
      .set('Content-Type', 'application/json')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ emoji: '❤️' });
    expectStatus(add, 200);
    expect(add.body).toMatchObject({ op: 'added' });

    const remove = await request(app)
      .post(`/status/${id}/reactions`)
      .set('X-Test-User-Id', '1')
      .set('Content-Type', 'application/json')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ emoji: '❤️' });
    expectStatus(remove, 200);
    expect(remove.body).toMatchObject({ op: 'removed' });
  });

  it('GET /status/:id visibility rules → CUSTOM self-only', async () => {
    const cust = await request(app)
      .post('/status')
      .set('X-Test-User-Id', '1')
      .set('Content-Type', 'application/json')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ caption: 'custom vis', audience: 'CUSTOM', customAudienceIds: [1] });
    expectStatus(cust, 201);
    const custId = cust.body.id;

    const custGetAs1 = await request(app)
      .get(`/status/${custId}`)
      .set('X-Test-User-Id', '1');
    expectStatus(custGetAs1, 200);

    const custGetAs2 = await request(app)
      .get(`/status/${custId}`)
      .set('X-Test-User-Id', '2');
    expect([403, 404]).toContain(custGetAs2.status);
  });
});

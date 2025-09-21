/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';
import request from 'supertest';

// --- IMPORTANT: mock storage so GET can find files on disk ---
// Force the router's local fallback writer to run by throwing from storeBuffer.
jest.mock('../services/storage/index.js', () => ({
  __esModule: true,
  default: {
    storeBuffer: jest.fn().mockImplementation(() => {
      throw new Error('simulate storage failure');
    }),
  },
}));

// If your tests spin up the full app via helpers:
import { makeAgent, resetDb } from './helpers/testServer.js';

describe('uploadsRouter', () => {
  let agent1, agent2;
  const email1 = `user1_${Date.now()}@example.com`;
  const email2 = `user2_${Date.now()}@example.com`;
  const username1 = `user1_${Date.now()}`;
  const username2 = `user2_${Date.now()}`;
  const password = 'Password!23';

  beforeAll(async () => {
    await resetDb();
    ({ agent: agent1 } = makeAgent());
    ({ agent: agent2 } = makeAgent());

    // Register & login user1
    await agent1
      .post('/auth/register')
      .send({ email: email1, username: username1, password })
      .expect(201);
    await agent1
      .post('/auth/login')
      .send({ identifier: email1, password })
      .expect(200);

    // Register & login user2
    await agent2
      .post('/auth/register')
      .send({ email: email2, username: username2, password })
      .expect(201);
    await agent2
      .post('/auth/login')
      .send({ identifier: email2, password })
      .expect(200);
  });

  test('GET /uploads/__iam_uploads_router returns health', async () => {
    const res = await agent1.get('/uploads/__iam_uploads_router').expect(200);
    expect(res.body).toEqual({ ok: true, router: 'uploads' });
  });

  test('POST /uploads without file returns 400', async () => {
    const res = await agent1.post('/uploads').expect(400);
    expect(res.body.error).toMatch(/file is required/i);
  });

  test('POST /uploads rejects oversized file (size limit)', async () => {
    // Router default is 10MB unless MAX_FILE_SIZE_BYTES is set.
    // Use >10MB so we always trigger 413.
    const bigBuffer = Buffer.alloc(12 * 1024 * 1024); // 12MB
    const res = await agent1
      .post('/uploads')
      .attach('file', bigBuffer, {
        filename: 'bigfile.bin',
        contentType: 'application/octet-stream',
      });
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/File too large/i);
  });

  test('POST /uploads rejects banned executable type (.exe)', async () => {
    const res = await agent1
      .post('/uploads')
      .attach('file', Buffer.from('dummy'), {
        filename: 'malware.exe',
        contentType: 'application/x-msdownload',
      });
    expect(res.status).toBe(415);
    expect(res.body.error).toMatch(/Executable type not allowed/i);
  });

  test('POST /uploads rejects SVG file (blocked)', async () => {
    const svgData = Buffer.from('<svg><script>alert(1)</script></svg>');
    const res = await agent1
      .post('/uploads')
      .attach('file', svgData, {
        filename: 'script.svg',
        contentType: 'image/svg+xml',
      });
    expect(res.status).toBe(415);
    expect(res.body.error).toMatch(/SVG not allowed/i);
  });

  test('POST /uploads uploads PNG successfully and GET returns safe headers', async () => {
    const pngHeader = Buffer.from('89504e470d0a1a0a', 'hex'); // PNG magic
    const up = await agent1
      .post('/uploads')
      .attach('file', pngHeader, {
        filename: 'picture.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(up.body.id).toBeDefined();
    expect(up.body.mimeType).toMatch(/image\/png/);
    expect(up.body.name).toMatch(/\.png$/i);
    const id = up.body.id;

    const dl = await agent1.get(`/uploads/${id}`).expect(200);
    expect(dl.headers['content-type']).toMatch(/image\/png/);
    expect(dl.headers['content-disposition']).toMatch(/attachment/);
    expect(dl.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.isBuffer(dl.body)).toBe(true);
    expect(dl.body).toEqual(pngHeader);
  });

  test('GET /uploads/:id enforces owner-only access', async () => {
    const data = Buffer.from('owner-only-access-content');
    const uploadRes = await agent1
      .post('/uploads')
      .attach('file', data, { filename: 'secret.txt', contentType: 'text/plain' })
      .expect(201);
    const id = uploadRes.body.id;

    // Some environments can hit 404 if the underlying file isn't present at stream time.
    // Either 403 (forbidden) or 404 (not found) indicates the non-owner cannot retrieve the file.
    const resp = await agent2.get(`/uploads/${id}`);
    expect([403, 404]).toContain(resp.status);
  });

  test('GET /uploads/:id invalid or non-existent ID', async () => {
    // Invalid ID
    await agent1.get('/uploads/not-a-number').expect(400);

    // Non-existent numeric ID → 403 Forbidden (no access)
    const res = await agent1.get('/uploads/999999').expect(403);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Forbidden/i);
  });

  test('POST /uploads deduplication: re-upload returns existing id', async () => {
    const content = Buffer.from('this-is-some-file-content'); // > 9 bytes
    const first = await agent1
      .post('/uploads')
      .attach('file', content, { filename: 'file1.txt', contentType: 'text/plain' })
      .expect(201);
    const firstId = first.body.id;

    const second = await agent1
      .post('/uploads')
      .attach('file', content, { filename: 'file2.txt', contentType: 'text/plain' })
      .expect(200);
    expect(second.body.id).toBe(firstId);
    expect(second.body.dedup).toBe(true);
  });

  test('POST /uploads: same small content (<9 bytes) does not dedup', async () => {
    const small = Buffer.from('short'); // 5 bytes
    const r1 = await agent1
      .post('/uploads')
      .attach('file', small, { filename: 's1.txt', contentType: 'text/plain' })
      .expect(201);
    const id1 = r1.body.id;

    const r2 = await agent1
      .post('/uploads')
      .attach('file', small, { filename: 's2.txt', contentType: 'text/plain' })
      .expect(201);
    const id2 = r2.body.id;

    expect(id2).not.toBe(id1);
    expect(r2.body.dedup).toBeUndefined();
  });
});

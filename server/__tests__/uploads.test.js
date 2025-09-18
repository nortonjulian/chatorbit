/**
 * @jest-environment node
 */
import request from 'supertest';

// Set a small cap so "size limit" is deterministic, then load the app.
beforeAll(() => {
  process.env.MAX_FILE_SIZE_BYTES = String(1 * 1024 * 1024); // 1MB for this test
});

let app; // we'll import lazily after env is set

describe('uploads security', () => {
  let agent1;
  let agent2;
  const email1 = `u1_${Date.now()}@example.com`;
  const email2 = `u2_${Date.now()}@example.com`;
  const username1 = `u1_${Date.now()}`;
  const username2 = `u2_${Date.now()}`;
  const password = 'Passw0rd!23';

  beforeAll(async () => {
    app = (await import('../app.js')).default;
    agent1 = request.agent(app);
    agent2 = request.agent(app);

    // user 1
    await agent1.post('/auth/register').send({ email: email1, username: username1, password }).expect(201);
    await agent1.post('/auth/login').send({ identifier: email1, password }).expect(200);

    // user 2
    await agent2.post('/auth/register').send({ email: email2, username: username2, password }).expect(201);
    await agent2.post('/auth/login').send({ identifier: email2, password }).expect(200);
  });

  test('rejects bad executable-type mime', async () => {
    const res = await agent1
      .post('/uploads')
      .attach('file', Buffer.from('fake exe'), {
        filename: 'x.exe',
        contentType: 'application/x-msdownload',
      });
    expect([400, 415]).toContain(res.status);
  });

  test('rejects SVG even if image/* (dangerous extension)', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const res = await agent1
      .post('/uploads')
      .attach('file', svg, {
        filename: 'evil.svg',
        contentType: 'image/svg+xml',
      });
    expect([400, 415]).toContain(res.status);
  });

  test('happy path image upload, download with safe headers', async () => {
    // tiny valid PNG header
    const pngHeader = Buffer.from('89504e470d0a1a0a', 'hex');

    const up = await agent1
      .post('/uploads')
      .attach('file', pngHeader, { filename: 'a.png', contentType: 'image/png' })
      .expect(201);

    expect(up.body.id).toBeTruthy();
    const id = up.body.id;

    const dl = await agent1.get(`/uploads/${id}`).expect(200);
    expect(dl.headers['content-type']).toMatch(/image\/png/);
    expect(dl.headers['content-disposition']).toMatch(/attachment/);
    expect(dl.headers['x-content-type-options']).toBe('nosniff');
  });

  test('owner-only ACL: other user cannot download', async () => {
    // upload as user1
    const pngHeader = Buffer.from('89504e470d0a1a0a', 'hex');
    const up = await agent1
      .post('/uploads')
      .attach('file', pngHeader, { filename: 'private.png', contentType: 'image/png' })
      .expect(201);

    const id = up.body.id;
    // user2 tries to access
    await agent2.get(`/uploads/${id}`).expect(403);
  });

  test('dedup: re-upload same content returns existing id', async () => {
    const content = Buffer.from('same-content');
    const first = await agent1
      .post('/uploads')
      .attach('file', content, { filename: 'doc.txt', contentType: 'text/plain' })
      .expect(201);

    const second = await agent1
      .post('/uploads')
      .attach('file', content, { filename: 'again.txt', contentType: 'text/plain' })
      .expect(200);

    // either explicit flag or same id is acceptable—assert one of them
    expect(second.body.dedup === true || second.body.id === first.body.id).toBeTruthy();
  });

  test('size limit enforced (uses 1MB cap set in beforeAll)', async () => {
    const big = Buffer.alloc(1.2 * 1024 * 1024); // ~1.2MB > 1MB cap
    const res = await agent1
      .post('/uploads')
      .attach('file', big, { filename: 'big.bin', contentType: 'application/octet-stream' });
    // Multer typically throws 413; some wrappers map to 400
    expect([400, 413]).toContain(res.status);
  });
});

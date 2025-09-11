import request from 'supertest';
import { createTestApp } from '../app.test-only.js';

describe('status router mounts when STATUS_ENABLED=true', () => {
  let app;

  beforeAll(() => {
    process.env.STATUS_ENABLED = 'true';
    process.env.NODE_ENV = 'test';
    app = createTestApp();
  });

  test('health ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('__routes_dump shows /status', async () => {
    const res = await request(app).get('/__routes_dump');
    expect(res.status).toBe(200);
    expect(res.body.statusFlag).toBe('true');
    expect(res.body.hasStatusRouter).toBe(true);
  });
});

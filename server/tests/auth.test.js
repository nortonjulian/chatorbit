import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import appFactory from './appFactory.js';

let app;
beforeAll(async () => {
  app = await appFactory();
});

describe('health', () => {
  it('responds with ok:true', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

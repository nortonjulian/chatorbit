import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import appFactory from '../testServerFactory.js';

let server, app;

beforeAll(async () => {
  app = await appFactory();
  server = http.createServer(app).listen();
});

afterAll(() => server.close());

function uniq() {
  return `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

describe('Auth', () => {
  it('rejects /auth/me when not logged in', async () => {
    const res = await request(server).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('login sets cookie and /auth/me returns user', async () => {
    const agent = request.agent(server);
    const id = uniq();
    const username = `demo${id}`;
    const email = `demo${id}@example.com`;
    const password = 'StrongP@ssw0rd123';

    const reg = await agent
      .post('/users')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username, email, password });

    if (reg.status >= 400) {
      throw new Error(`Register failed ${reg.status} ${JSON.stringify(reg.body)}`);
    }
    expect(reg.status).toBeLessThan(400);

    const res = await agent
      .post('/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username, password });

    if (res.status >= 400) {
      throw new Error(`Login failed ${res.status} ${JSON.stringify(res.body)}`);
    }
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();

    const me = await agent.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body?.user?.username).toBe(username);
  });
});

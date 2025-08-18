import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import appFactory from '../testServerFactory.js'; // tiny helper to build your app

let server, app;

beforeAll(async () => {
  app = await appFactory(); // returns an Express app with routes mounted
  server = http.createServer(app).listen();
});

afterAll(() => server.close());

describe('Auth', () => {
  it('rejects /auth/me when not logged in', async () => {
    const res = await request(server).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('login sets cookie and /auth/me returns user', async () => {
    const agent = request.agent(server);
    const res = await agent.post('/auth/login').send({ username: 'demo', password: 'demo' });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();

    const me = await agent.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body?.user?.username).toBeDefined();
  });
});

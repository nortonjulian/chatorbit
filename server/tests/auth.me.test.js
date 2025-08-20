import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import appFactory from '../testServerFactory.js';

let app;
beforeAll(async () => {
  app = await appFactory();
});

function uniq() {
  // add extra entropy so parallel runs don't collide
  return `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

describe('Auth: register → login → /auth/me', () => {
  it('registers, logs in, and returns /auth/me', async () => {
    const agent = request.agent(app);
    const id = uniq();
    const username = `user${id}`;            // letters+digits only
    const email = `user${id}@example.com`;
    const password = 'StrongP@ssw0rd123';    // long & complex

    // Register (must include CSRF header)
    const r1 = await agent
      .post('/users')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username, email, password });

    if (r1.status >= 400) {
      // Make failures obvious in CI output
      throw new Error(`Register failed ${r1.status} ${JSON.stringify(r1.body)}`);
    }
    expect(r1.status).toBeLessThan(400);

    // Login (CSRF header too)
    const r2 = await agent
      .post('/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username, password });

    if (r2.status >= 400) {
      throw new Error(`Login failed ${r2.status} ${JSON.stringify(r2.body)}`);
    }
    expect(r2.status).toBe(200);

    // /auth/me
    const me = await agent.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body?.user?.username).toBe(username);
  });
});

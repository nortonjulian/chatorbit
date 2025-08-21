import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import makeApp from '../appFactory.js';

describe('Security: messages read requires auth', () => {
  let app, agent, roomId;

  beforeAll(async () => {
    app = await makeApp();
    agent = request.agent(app);

    const username = `s_${Date.now()}`;
    await agent.post('/auth/register').send({ username, email: `${username}@t.local`, password: 'pw123456' });
    await agent.post('/auth/login').send({ username, password: 'pw123456' });

    const r = await agent.post('/chatrooms').send({ name: 'secure-room', isGroup: false }).catch(() => null);
    roomId = r?.body?.id ?? r?.body?.room?.id ?? r?.body?.data?.id ?? 1;
  });

  it('anonymous is rejected', async () => {
    const anon = request(app);
    const res = await anon.get(`/messages/${roomId}?limit=5`);
    expect([401, 403, 404]).toContain(res.status);
  });
});

import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import makeApp from '../appFactory.js';

describe('Security: cannot send message to a room non-member', () => {
  let app, agentA, agentB, roomId;

  beforeAll(async () => {
    app = await makeApp();
    agentA = request.agent(app);

    const u1 = `a_${Date.now()}`;
    await agentA.post('/auth/register').send({ username: u1, email: `${u1}@t.local`, password: 'pw123456' });
    await agentA.post('/auth/login').send({ username: u1, password: 'pw123456' });
    const r = await agentA.post('/chatrooms').send({ name: 'room-a', isGroup: false }).catch(() => null);
    roomId = r?.body?.id ?? r?.body?.room?.id ?? r?.body?.data?.id ?? 1;

    agentB = request.agent(app);
    const u2 = `b_${Date.now()}`;
    await agentB.post('/auth/register').send({ username: u2, email: `${u2}@t.local`, password: 'pw123456' });
    await agentB.post('/auth/login').send({ username: u2, password: 'pw123456' });
  });

  it('rejects non-member sends', async () => {
    const res = await agentB.post('/messages').send({ chatRoomId: roomId, content: 'hijack' });
    expect([401, 403, 404]).toContain(res.status);
  });
});

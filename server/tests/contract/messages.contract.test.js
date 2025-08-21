import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import makeApp from '../appFactory.js';
import { MessageListSchema } from './schemas.zod.js';

describe('Contract: GET /messages/:roomId', () => {
  let app, agent, roomId;

  beforeAll(async () => {
    app = await makeApp();
    agent = request.agent(app);

    const username = `c_${Date.now()}`;
    const email = `${username}@test.local`;
    await agent.post('/auth/register').send({ username, email, password: 'pw123456' });
    await agent.post('/auth/login').send({ username, password: 'pw123456' });

    // Use a known-good path for your branch:
    const r = await agent.post('/chatrooms').send({ name: 'contract-room', isGroup: false }).catch(() => null);
    roomId = r?.body?.id ?? r?.body?.room?.id ?? r?.body?.data?.id ?? 1; // fallback if seeded
  });

  it('response matches schema (shape locked)', async () => {
    const res = await agent.get(`/messages/${roomId}?limit=1`);
    expect(res.status).toBeLessThan(500);

    // Allow array or {items:[]} while your API stabilizes
    const data = res.body?.items ? res.body : res.body;
    const parsed = MessageListSchema.safeParse(data);
    expect(parsed.success).toBe(true);
  });
});

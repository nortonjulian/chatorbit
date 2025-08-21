import request from 'supertest';
import makeApp from './appFactory.js';

// helpers from snippet above: createRoomResilient, pickRoomId
// Helpers to make the tests route-agnostic while your API settles
async function createRoomResilient(agent, body) {
  const candidates = [
    { method: 'post', path: '/chatrooms' },
    { method: 'post', path: '/rooms' },
    { method: 'post', path: '/api/chatrooms' },
    { method: 'post', path: '/api/rooms' },
  ];

  for (const c of candidates) {
    const res = await agent[c.method](c.path)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send(body);

    if (res.status < 400) return res;
  }

  throw new Error('Could not create a room via any known endpoint');
}

function pickRoomId(obj) {
  return obj?.id ?? obj?.room?.id ?? obj?.data?.id ?? obj?.data?.room?.id;
}


describe('Invites', () => {
  let app, agent, roomId;

  beforeAll(async () => {
    app = await makeApp();
    agent = request.agent(app);

    const username = `inv_${Date.now()}`;
    const email = `${username}@test.local`;

    await agent.post('/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username, email, password: 'pw123456' });

    await agent.post('/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username, password: 'pw123456' });

    const r = await createRoomResilient(agent, { name: `room_${Date.now()}`, isGroup: true });
    roomId = pickRoomId(r.body);
    expect(roomId).toBeTruthy();
  });

  it('creates a group invite and can redeem it', async () => {
    // Prefer the new explicit group-invite route
    const create = await agent
      .post(`/chatrooms/${roomId}/invites`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ maxUses: 1 });

    // If that 404s, fall back to a generic invites creator if you support it:
    if (create.status >= 400) {
      // try an alternative you may have
      // const alt = await agent.post('/api/invites').send({ chatRoomId: roomId, maxUses: 1 });
      // expect(alt.status).toBeLessThan(400);
      // create = alt;
      throw new Error('Group-invite route not found: POST /chatrooms/:roomId/invites');
    }

    const code =
      create.body?.code ??
      create.body?.invite?.code ??
      create.body?.data?.code;

    expect(code).toBeTruthy();

    // second user
    const agent2 = request.agent(app);
    const username2 = `join_${Date.now()}`;
    const email2 = `${username2}@test.local`;

    await agent2.post('/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: username2, email: email2, password: 'pw123456' });

    await agent2.post('/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: username2, password: 'pw123456' });

    const redeem = await agent2
      .post(`/invites/${code}/accept`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send();

    expect(redeem.status).toBeLessThan(400);

    const redeemedRoomId =
      redeem.body?.chatRoomId ??
      redeem.body?.room?.id ??
      redeem.body?.data?.roomId ??
      redeem.body?.data?.room?.id;

    expect(redeemedRoomId).toBe(roomId);
  });
});

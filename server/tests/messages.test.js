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


describe('Messaging', () => {
  let app, agent, room;

  beforeAll(async () => {
    app = await makeApp();
    agent = request.agent(app);

    const username = `m_${Date.now()}`;
    const email = `${username}@test.local`;

    await agent.post('/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username, email, password: 'pw123456' });

    await agent.post('/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username, password: 'pw123456' });

    // Try several possible endpoints for room creation
    const r = await createRoomResilient(agent, { name: `room_${Date.now()}`, isGroup: false });
    const roomId = pickRoomId(r.body);
    expect(roomId).toBeTruthy();
    room = { id: roomId };
  });

  it('sends and fetches a message', async () => {
    const content = 'hello from test';

    // ✅ current API expects POST /messages with { chatRoomId, content }
    const send = await agent.post('/messages')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ chatRoomId: room.id, content });

    expect(send.status).toBeLessThan(400);

    const sentMessage = send.body?.message ?? send.body?.data?.message ?? send.body;
    expect(sentMessage?.id ?? sentMessage?._id ?? sentMessage?.data?.id).toBeTruthy();

    // ✅ fetch via GET /messages/:chatRoomId
    const list = await agent.get(`/messages/${room.id}?limit=20`);
    expect(list.status).toBe(200);

    const items =
      list.body?.items ??
      list.body?.messages ??
      (Array.isArray(list.body) ? list.body : []) ??
      [];

    const found = items.find((m) => (m.rawContent ?? m.content) === content);
    expect(found).toBeTruthy();
  });
});

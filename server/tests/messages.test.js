import request from 'supertest';
import makeApp from './appFactory.js';

describe('Messaging', () => {
  let app, agent, user, room;

  beforeAll(async () => {
    app = await makeApp();
    agent = request.agent(app);

    const username = `m_${Date.now()}`;
    const email = `${username}@test.local`;

    await agent
      .post('/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username, email, password: 'pw123456' });

    await agent
      .post('/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username, password: 'pw123456' });

    const me = await agent.get('/auth/me');
    user = me.body.user;

    // create a room (adjust endpoint if yours differs)
    const r = await agent
      .post('/chatrooms')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ name: `room_${Date.now()}`, isGroup: false });
    expect(r.status).toBeLessThan(400);
    room = r.body || r.body?.room || r.body?.data || {};
  });

  it('sends and fetches a message', async () => {
    const content = 'hello from test';

    const send = await agent
      .post(`/messages/${room.id}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content });
    expect(send.status).toBeLessThan(400);

    const list = await agent.get(`/messages/${room.id}?limit=20`);
    expect(list.status).toBe(200);
    const items = list.body.items || list.body || [];
    const found = items.find((m) => (m.rawContent || m.content) === content);
    expect(found).toBeTruthy();
  });
});

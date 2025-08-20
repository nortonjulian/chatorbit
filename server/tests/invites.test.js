import request from 'supertest';
import makeApp from './appFactory.js';

describe('Invites', () => {
  let app, agent, roomId;

  beforeAll(async () => {
    app = await makeApp();
    agent = request.agent(app);

    const username = `inv_${Date.now()}`;
    const email = `${username}@test.local`;

    await agent
      .post('/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username, email, password: 'pw123456' });

    await agent
      .post('/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username, password: 'pw123456' });

    const r = await agent
      .post('/chatrooms')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ name: `room_${Date.now()}`, isGroup: true });
    expect(r.status).toBeLessThan(400);
    roomId = r.body?.id ?? r.body?.room?.id ?? r.body?.data?.id;
  });

  it('creates an invite and can redeem it', async () => {
    const create = await agent
      .post('/invites')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ chatRoomId: roomId, maxUses: 1 });
    expect(create.status).toBeLessThan(400);

    const code = create.body?.code ?? create.body?.invite?.code;
    expect(code).toBeTruthy();

    // Simulate a second user redeeming
    const agent2 = request.agent(app);
    const username2 = `join_${Date.now()}`;
    const email2 = `${username2}@test.local`;

    await agent2
      .post('/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: username2, email: email2, password: 'pw123456' });
    await agent2
      .post('/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: username2, password: 'pw123456' });

    const redeem = await agent2
      .post('/invites/redeem')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ code });
    expect(redeem.status).toBeLessThan(400);
    expect(redeem.body?.chatRoomId || redeem.body?.room?.id).toBeTruthy();
  });
});

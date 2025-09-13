import { makeAgent, resetDb } from './helpers/testServer.js';

const ENDPOINTS = {
  register: '/auth/register',
  login: '/auth/login',
  createRoom: '/chatrooms',
  sendMessage: '/messages',
  editMessage: (id) => `/messages/${id}`,
};

describe('Messages: edit rules', () => {
  let agent;
  let roomId;
  let messageId;

  beforeAll(() => {
    agent = makeAgent().agent;
  });

  beforeEach(async () => {
    await resetDb();

    const email = 'chris@example.com';
    const password = 'Test12345!';
    const username = 'chris';

    await agent.post(ENDPOINTS.register).send({ email, password, username }).expect(201);
    await agent.post(ENDPOINTS.login).send({ email, password }).expect(200);

    const r = await agent
      .post(ENDPOINTS.createRoom)
      .send({ name: 'Room B', isGroup: false })
      .expect(201);
    roomId = r.body.id || r.body.room?.id;

    const m = await agent.post(ENDPOINTS.sendMessage)
      .send({ chatRoomId: roomId, content: 'first', kind: 'TEXT' }).expect(201);
    messageId = m.body.id || m.body.message?.id;
  });

  test('can edit before anyone reads', async () => {
    await agent
      .patch(ENDPOINTS.editMessage(messageId))
      .send({ content: 'edited' })
      .expect(200);
  });

  test.skip('fails to edit after a non-sender read (expect 409)', async () => {
    // Implement when mark-read endpoint is ready.
  });
});

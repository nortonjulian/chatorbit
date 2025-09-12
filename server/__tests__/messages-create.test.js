import { makeAgent, resetDb } from './helpers/testServer.js';

const ENDPOINTS = {
  register: '/auth/register',
  login: '/auth/login',
  createRoom: '/chatrooms',
  sendMessage: '/messages',
  react: (id) => `/messages/${id}/reactions`,
  // For media: '/messages' with multipart/form-data
};

describe('Messages: create + reactions', () => {
  let agent;
  let user;
  let roomId;

  beforeAll(() => {
    agent = makeAgent().agent;
  });

  beforeEach(async () => {
    await resetDb();

    const email = 'bob@example.com';
    const password = 'Test12345!';
    const username = 'bob';

    await agent.post(ENDPOINTS.register).send({ email, password, username }).expect(201);
    await agent.post(ENDPOINTS.login).send({ email, password }).expect(200);

    const r = await agent.post(ENDPOINTS.createRoom).send({ name: 'Room A', isGroup: true }).expect(201);
    roomId = r.body.id || r.body.room?.id;
    expect(roomId).toBeDefined();
  });

  test('create text message and add/remove reaction', async () => {
    const m = await agent
      .post(ENDPOINTS.sendMessage)
      .send({ roomId, content: 'hello', kind: 'TEXT' })
      .expect(201);

    const messageId = m.body.id || m.body.message?.id;
    expect(messageId).toBeDefined();

    await agent.post(ENDPOINTS.react(messageId)).send({ emoji: '👍' }).expect(200);

    // remove reaction — adjust to your API (DELETE or POST toggle)
    await agent.delete(ENDPOINTS.react(messageId)).send({ emoji: '👍' }).expect(200);
  });

  test.skip('create media message (multipart) [TODO]', async () => {
    // Example when you wire it up:
    // await agent
    //   .post(ENDPOINTS.sendMessage)
    //   .field('roomId', String(roomId))
    //   .field('kind', 'IMAGE')
    //   .attach('files', Buffer.from('...'), 'pic.jpg')
    //   .expect(201);
  });
});

import { makeAgent, resetDb } from './helpers/testServer.js';
import prisma from '../utils/prismaClient.js';

const ENDPOINTS = {
  register: '/auth/register',
  login: '/auth/login',
  createRoom: '/chatrooms',
  sendMessage: '/messages',
  deleteMessage: (id) => `/messages/${id}`,
};

describe('Messages: delete (sender vs admin)', () => {
  let agentUser, agentAdmin, roomId, messageId;

  beforeAll(() => {
    agentUser = makeAgent().agent;
    agentAdmin = makeAgent().agent;
  });

  beforeEach(async () => {
    await resetDb();

    // user
    await agentUser.post(ENDPOINTS.register).send({
      email: 'dana@example.com', password: 'Test12345!', username: 'dana',
    }).expect(201);
    await agentUser.post(ENDPOINTS.login).send({ email: 'dana@example.com', password: 'Test12345!' }).expect(200);

    // admin
    await agentAdmin.post(ENDPOINTS.register).send({
      email: 'admin@example.com', password: 'Test12345!', username: 'admin',
    }).expect(201);
    // flip to ADMIN in DB (adjust if you store roles differently)
    const admin = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
    await agentAdmin.post(ENDPOINTS.login).send({ email: 'admin@example.com', password: 'Test12345!' }).expect(200);

    const r = await agentUser.post(ENDPOINTS.createRoom).send({ name: 'Room C', isGroup: true }).expect(201);
    roomId = r.body.id || r.body.room?.id;

    const m = await agentUser.post(ENDPOINTS.sendMessage).send({ roomId, content: 'to delete', kind: 'TEXT' }).expect(201);
    messageId = m.body.id || m.body.message?.id;
  });

  test('sender can delete own message', async () => {
    await agentUser.delete(ENDPOINTS.deleteMessage(messageId)).expect(200);
  });

  test('admin can delete any message', async () => {
    // Recreate one
    const m = await agentUser.post(ENDPOINTS.sendMessage).send({ roomId, content: 'admin will delete', kind: 'TEXT' }).expect(201);
    const id = m.body.id || m.body.message?.id;

    await agentAdmin.delete(ENDPOINTS.deleteMessage(id)).expect(200);
  });
});

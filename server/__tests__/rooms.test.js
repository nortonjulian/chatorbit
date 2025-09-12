import { makeAgent, resetDb } from './helpers/testServer.js';
import prisma from '../utils/prismaClient.js';

const ENDPOINTS = {
  register: '/auth/register',
  login: '/auth/login',
  createRoom: '/chatrooms',
  // group invites may be: '/group-invites' (create) and '/group-invites/:code/join' (join)
  createInvite: (roomId) => `/group-invites/${roomId}`,
  joinWithCode: (code) => `/group-invites/${code}/join`,
  leaveRoom: (roomId) => `/chatrooms/${roomId}/leave`,
  promote: (roomId, userId) => `/chatrooms/${roomId}/participants/${userId}/promote`,
};

describe('Rooms: create/join/leave and permissions', () => {
  let ownerAgent, memberAgent, roomId, ownerId, memberId;

  beforeAll(() => {
    ownerAgent = makeAgent().agent;
    memberAgent = makeAgent().agent;
  });

  beforeEach(async () => {
    await resetDb();

    // owner
    await ownerAgent.post(ENDPOINTS.register).send({
      email: 'owner@example.com', password: 'Test12345!', username: 'owner',
    }).expect(201);
    await ownerAgent.post(ENDPOINTS.login).send({ email: 'owner@example.com', password: 'Test12345!' }).expect(200);
    ownerId = (await prisma.user.findUnique({ where: { email: 'owner@example.com' } })).id;

    // member
    await memberAgent.post(ENDPOINTS.register).send({
      email: 'eve@example.com', password: 'Test12345!', username: 'eve',
    }).expect(201);
    await memberAgent.post(ENDPOINTS.login).send({ email: 'eve@example.com', password: 'Test12345!' }).expect(200);
    memberId = (await prisma.user.findUnique({ where: { email: 'eve@example.com' } })).id;

    const r = await ownerAgent.post(ENDPOINTS.createRoom).send({ name: 'Room D', isGroup: true }).expect(201);
    roomId = r.body.id || r.body.room?.id;
  });

  test('owner can promote to admin', async () => {
    // directly insert participant or use invite/join flow if present
    await prisma.participant.create({ data: { roomId, userId: memberId, role: 'MEMBER' } });

    await ownerAgent.post(ENDPOINTS.promote(roomId, memberId)).expect(200);

    const after = await prisma.participant.findFirst({ where: { roomId, userId: memberId } });
    expect(after.role).toBe('ADMIN');
  });

  test.skip('invite code join / leave', async () => {
    // Unskip when your invite endpoints are ready/confirmed
    // const invite = await ownerAgent.post(ENDPOINTS.createInvite(roomId)).expect(201);
    // const code = invite.body.code;

    // await memberAgent.post(ENDPOINTS.joinWithCode(code)).expect(200);
    // await memberAgent.post(ENDPOINTS.leaveRoom(roomId)).expect(200);
  });
});

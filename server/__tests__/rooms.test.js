import { makeAgent, resetDb } from './helpers/testServer.js';
import prisma from '../utils/prismaClient.js';

const ENDPOINTS = {
  register: '/auth/register',
  login: '/auth/login',
  me: '/auth/me',
  createRoom: '/chatrooms',
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

    // owner (register for cookie/session)
    const ownerReg = await ownerAgent
      .post(ENDPOINTS.register)
      .send({ email: 'owner@example.com', password: 'Test12345!', username: 'owner' })
      .expect(201);

    await ownerAgent
      .post(ENDPOINTS.login)
      .send({ email: 'owner@example.com', password: 'Test12345!' })
      .expect(200);

    ownerId = ownerReg.body?.user?.id;
    if (!ownerId) {
      const me = await ownerAgent.get(ENDPOINTS.me).expect(200);
      ownerId = me.body?.user?.id;
    }
    expect(ownerId).toBeDefined();

    // member (register for cookie/session)
    const memberReg = await memberAgent
      .post(ENDPOINTS.register)
      .send({ email: 'eve@example.com', password: 'Test12345!', username: 'eve' })
      .expect(201);

    await memberAgent
      .post(ENDPOINTS.login)
      .send({ email: 'eve@example.com', password: 'Test12345!' })
      .expect(200);

    memberId = memberReg.body?.user?.id;
    if (!memberId) {
      const me = await memberAgent.get(ENDPOINTS.me).expect(200);
      memberId = me.body?.user?.id;
    }
    expect(memberId).toBeDefined();

    // Owner creates the room (API path)
    const r = await ownerAgent
      .post(ENDPOINTS.createRoom)
      .send({ name: 'Room D', isGroup: true })
      .expect(201);

    roomId = r.body.id || r.body.room?.id;
    expect(roomId).toBeDefined();
  });

  test('owner can promote to admin', async () => {
    const memberIdNum =
      typeof memberId === 'string' && /^\d+$/.test(memberId) ? Number(memberId) : memberId;

    // Ensure member is a participant (FKs are satisfied because /auth/register persisted users)
    await prisma.participant.upsert({
      where: { chatRoomId_userId: { chatRoomId: roomId, userId: memberIdNum } },
      update: { role: 'MEMBER' },
      create: { chatRoomId: roomId, userId: memberIdNum, role: 'MEMBER' },
    });

    await ownerAgent.post(ENDPOINTS.promote(roomId, memberId)).expect(200);

    const after = await prisma.participant.findUnique({
      where: { chatRoomId_userId: { chatRoomId: roomId, userId: memberIdNum } },
      select: { role: true },
    });
    expect(after?.role).toBe('ADMIN');
  });

  test.skip('invite code join / leave', async () => {
    // Unskip when your invite endpoints are ready/confirmed
    // const invite = await ownerAgent.post(ENDPOINTS.createInvite(roomId)).expect(201);
    // const code = invite.body.code;
    // await memberAgent.post(ENDPOINTS.joinWithCode(code)).expect(200);
    // await memberAgent.post(ENDPOINTS.leaveRoom(roomId)).expect(200);
  });
});

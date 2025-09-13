import prisma from '../utils/prismaClient.js';

export async function getRoomWithOwner(roomId) {
  return prisma.chatRoom.findUnique({
    where: { id: Number(roomId) },
    select: { id: true, ownerId: true },
  });
}

export async function getParticipantRole(roomId, userId) {
  const p = await prisma.participant.findUnique({
    where: { chatRoomId_userId: { chatRoomId: Number(roomId), userId: Number(userId) } },
    select: { role: true },
  });
  return p?.role ?? null;
}

export async function requireOwner(req, roomId) {
  const room = await getRoomWithOwner(roomId);
  if (!room) return { ok: false, code: 404, error: 'Room not found' };
  if (Number(req.user.id) !== room.ownerId) {
    return { ok: false, code: 403, error: 'Owner required' };
  }
  return { ok: true, room };
}

export async function requireOwnerOrAdmin(req, roomId) {
  const room = await getRoomWithOwner(roomId);
  if (!room) return { ok: false, code: 404, error: 'Room not found' };
  if (Number(req.user.id) === room.ownerId) return { ok: true, room, role: 'OWNER' };

  const role = await getParticipantRole(roomId, req.user.id);
  if (role === 'ADMIN') return { ok: true, room, role: 'ADMIN' };
  return { ok: false, code: 403, error: 'Owner or ADMIN required' };
}

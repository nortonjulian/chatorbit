export const RoleRank = { MEMBER: 0, MODERATOR: 1, ADMIN: 2, OWNER: 3 };

export async function getEffectiveRoomRank(prisma, userId, roomId) {
  const room = await prisma.chatRoom.findUnique({
    where: { id: Number(roomId) },
    select: { ownerId: true },
  });
  if (!room) return -1;
  if (room.ownerId === Number(userId)) return RoleRank.OWNER;

  const p = await prisma.participant.findUnique({
    where: { userId_chatRoomId: { userId: Number(userId), chatRoomId: Number(roomId) } },
    select: { role: true },
  });
  if (!p) return -1;
  return RoleRank[p.role] ?? RoleRank.MEMBER;
}

export function requireRoomRank(prisma, minRank) {
  return async (req, res, next) => {
    try {
      const roomId = Number(req.params.id || req.body.chatRoomId);
      const rank = await getEffectiveRoomRank(prisma, req.user.id, roomId);
      if (rank < minRank) return res.status(403).json({ error: 'Forbidden' });
      next();
    } catch (e) {
      next(e);
    }
  };
}

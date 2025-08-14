import express from 'express';
import Boom from '@hapi/boom';
import prisma from '../utils/prismaClient.js';
import { verifyToken } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireRoomRank, RoleRank, getEffectiveRoomRank } from '../utils/roomAuth.js';

const router = express.Router();

/** Owner-or-admin guard for a room (admins bypass) */
const requireRoomOwner = async (req, _res, next) => {
  const roomId = Number(req.params.id ?? req.body?.chatRoomId);
  if (!Number.isFinite(roomId)) throw Boom.badRequest('Invalid room id');

  const userId = req.user?.id;
  const isAdmin = req.user?.role === 'ADMIN';
  if (isAdmin) return next();

  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    select: { ownerId: true },
  });

  if (!room) throw Boom.notFound('Room not found');
  if (room.ownerId !== userId) throw Boom.forbidden('Only the owner can perform this action');

  return next();
};

// GET /chatrooms
router.get(
  '/',
  verifyToken,
  asyncHandler(async (req, res) => {
    const { userId } = req.query;
    const where = userId
      ? { participants: { some: { userId: Number(userId) } } }
      : {};

    const chatRooms = await prisma.chatRoom.findMany({
      where,
      include: { participants: { include: { user: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json(chatRooms);
  })
);

// POST /chatrooms/direct/:targetUserId
router.post(
  '/direct/:targetUserId',
  verifyToken,
  asyncHandler(async (req, res) => {
    const userId1 = req.user.id;
    const userId2 = Number(req.params.targetUserId);

    if (!userId1 || !userId2 || userId1 === userId2) {
      throw Boom.badRequest('Invalid or duplicate user IDs');
    }

    const existingRoom = await prisma.chatRoom.findFirst({
      where: {
        isGroup: false,
        participants: {
          every: { OR: [{ userId: userId1 }, { userId: userId2 }] },
        },
      },
      include: { participants: true },
    });

    if (existingRoom) return res.json(existingRoom);

    const newChatRoom = await prisma.chatRoom.create({
      data: {
        isGroup: false,
        participants: {
          create: [
            { user: { connect: { id: userId1 } } },
            { user: { connect: { id: userId2 } } },
          ],
        },
      },
      include: { participants: true },
    });

    return res.status(201).json(newChatRoom);
  })
);

// POST /chatrooms/group
router.post(
  '/group',
  verifyToken,
  asyncHandler(async (req, res) => {
    const { userIds, name } = req.body || {};
    if (!Array.isArray(userIds) || userIds.length < 2) {
      throw Boom.badRequest('Provide at least 2 user IDs for a group chat');
    }
    const idsNum = userIds.map(Number);

    // Step 1: candidate rooms that include all target users
    const possibleRooms = await prisma.chatRoom.findMany({
      where: {
        isGroup: true,
        participants: { every: { userId: { in: idsNum } } },
      },
      include: { participants: true },
    });

    // Step 2: exact participant match
    const targetSorted = [...idsNum].sort();
    const matchingRoom = possibleRooms.find((room) => {
      const ids = room.participants.map((p) => p.userId).sort();
      return ids.length === targetSorted.length &&
             ids.every((id, idx) => id === targetSorted[idx]);
    });

    if (matchingRoom) return res.json(matchingRoom);

    // Step 3: create new
    const newRoom = await prisma.chatRoom.create({
      data: {
        name: name || 'Group chat',
        isGroup: true,
        participants: {
          create: idsNum.map((id) => ({ user: { connect: { id } } })),
        },
      },
      include: { participants: true },
    });

    return res.status(201).json(newRoom);
  })
);

// GET /chatrooms/:id/public-keys
router.get(
  '/:id/public-keys',
  verifyToken,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw Boom.badRequest('Invalid id');

    const participants = await prisma.participant.findMany({
      where: { chatRoomId: id },
      include: {
        user: { select: { id: true, publicKey: true, username: true } },
      },
    });

    return res.json(participants.map((p) => p.user));
  })
);

// PATCH /chatrooms/:id/auto-translate
router.patch(
  '/:id/auto-translate',
  verifyToken,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { mode } = req.body ?? {};
    if (!Number.isFinite(id)) throw Boom.badRequest('Invalid id');
    if (!['off', 'tagged', 'all'].includes(mode)) {
      throw Boom.badRequest('invalid mode');
    }

    // Authorization: owner/admin required
    const rank = await getEffectiveRoomRank(prisma, req.user.id, id);
    if (req.user.role !== 'ADMIN' && rank < RoleRank.ADMIN) {
      throw Boom.forbidden('Insufficient permissions');
    }

    const updated = await prisma.chatRoom.update({
      where: { id },
      data: { autoTranslateMode: mode },
      select: { id: true, autoTranslateMode: true },
    });

    return res.json(updated);
  })
);

// PATCH /chatrooms/:id/ai-assistant  (owner/admin)
router.patch(
  '/:id/ai-assistant',
  verifyToken,
  asyncHandler(requireRoomOwner),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { mode } = req.body || {};
    if (!['off', 'mention', 'always'].includes(mode)) {
      throw Boom.badRequest('Invalid mode');
    }

    const updated = await prisma.chatRoom.update({
      where: { id },
      data: { aiAssistantMode: mode },
      select: { id: true, aiAssistantMode: true },
    });

    return res.json(updated);
  })
);

// PATCH /chatrooms/:id/ai-opt (per-user setting in room)
router.patch(
  '/:id/ai-opt',
  verifyToken,
  asyncHandler(async (req, res) => {
    const roomId = Number(req.params.id);
    const { allow } = req.body || {};
    if (!Number.isFinite(roomId)) throw Boom.badRequest('Invalid id');

    await prisma.participant.update({
      where: { userId_chatRoomId: { userId: req.user.id, chatRoomId: roomId } },
      data: { allowAIBot: !!allow },
    });

    return res.json({ ok: true, allowAIBot: !!allow });
  })
);

// GET /chatrooms/:id/participants
router.get(
  '/:id/participants',
  verifyToken,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw Boom.badRequest('Invalid id');

    const [list, room] = await Promise.all([
      prisma.participant.findMany({
        where: { chatRoomId: id },
        select: {
          userId: true,
          role: true,
          user: { select: { id: true, username: true, avatarUrl: true } },
        },
        orderBy: [{ role: 'desc' }, { userId: 'asc' }],
      }),
      prisma.chatRoom.findUnique({
        where: { id },
        select: { ownerId: true },
      }),
    ]);

    return res.json({ ownerId: room?.ownerId ?? null, participants: list });
  })
);

// POST /chatrooms/:id/participants  (admins+)
router.post(
  '/:id/participants',
  verifyToken,
  requireRoomRank(prisma, RoleRank.ADMIN),
  asyncHandler(async (req, res) => {
    const roomId = Number(req.params.id);
    const { userId } = req.body ?? {};
    if (!Number.isFinite(roomId)) throw Boom.badRequest('Invalid id');
    if (!userId) throw Boom.badRequest('userId required');

    const existing = await prisma.participant.findUnique({
      where: { userId_chatRoomId: { userId: Number(userId), chatRoomId: roomId } },
    });
    if (existing) return res.json({ ok: true });

    const created = await prisma.participant.create({
      data: { userId: Number(userId), chatRoomId: roomId, role: 'MEMBER' },
      select: { userId: true, role: true },
    });

    // io?.to(roomId).emit('room:member_added', { userId })
    return res.json({ ok: true, participant: created });
  })
);

// DELETE /chatrooms/:id/participants/:userId (rank ladder)
router.delete(
  '/:id/participants/:userId',
  verifyToken,
  asyncHandler(async (req, res) => {
    const roomId = Number(req.params.id);
    const targetId = Number(req.params.userId);
    if (!Number.isFinite(roomId) || !Number.isFinite(targetId)) {
      throw Boom.badRequest('Invalid id');
    }

    const actorRank = await getEffectiveRoomRank(prisma, req.user.id, roomId);
    if (actorRank < RoleRank.MODERATOR) throw Boom.forbidden('Forbidden');

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: { ownerId: true },
    });
    if (!room) throw Boom.notFound('Room not found');
    if (room.ownerId === targetId) throw Boom.forbidden('Cannot remove owner');

    const target = await prisma.participant.findUnique({
      where: { userId_chatRoomId: { userId: targetId, chatRoomId: roomId } },
      select: { role: true },
    });
    if (!target) return res.json({ ok: true }); // idempotent

    const targetRank = RoleRank[target.role] ?? RoleRank.MEMBER;

    const canKick =
      (actorRank >= RoleRank.OWNER) ||
      (actorRank >= RoleRank.ADMIN && targetRank <= RoleRank.MODERATOR) ||
      (actorRank >= RoleRank.MODERATOR && targetRank <= RoleRank.MEMBER);

    if (!canKick) throw Boom.forbidden('Insufficient rank');

    await prisma.participant.delete({
      where: { userId_chatRoomId: { userId: targetId, chatRoomId: roomId } },
    });

    // io?.to(roomId).emit('room:member_removed', { userId: targetId })
    return res.json({ ok: true });
  })
);

// PATCH /chatrooms/:id/participants/:userId/role
// (only owner can grant ADMIN; admins can set MODERATOR/MEMBER)
router.patch(
  '/:id/participants/:userId/role',
  verifyToken,
  asyncHandler(async (req, res) => {
    const roomId = Number(req.params.id);
    const targetId = Number(req.params.userId);
    const { role } = req.body ?? {};

    if (!Number.isFinite(roomId) || !Number.isFinite(targetId)) {
      throw Boom.badRequest('Invalid id');
    }
    if (!['ADMIN', 'MODERATOR', 'MEMBER'].includes(role)) {
      throw Boom.badRequest('Invalid role');
    }

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: { ownerId: true },
    });
    if (!room) throw Boom.notFound('Room not found');

    const actorRank = await getEffectiveRoomRank(prisma, req.user.id, roomId);
    if (actorRank < RoleRank.ADMIN) throw Boom.forbidden('Forbidden');

    if (role === 'ADMIN' && actorRank < RoleRank.OWNER) {
      throw Boom.forbidden('Only owner can grant ADMIN');
    }
    if (room.ownerId === targetId) {
      throw Boom.forbidden('Cannot change owner role');
    }

    const updated = await prisma.participant.update({
      where: { userId_chatRoomId: { userId: targetId, chatRoomId: roomId } },
      data: { role },
      select: { userId: true, role: true },
    });

    // io?.to(roomId).emit('room:role_changed', updated)
    return res.json({ ok: true, participant: updated });
  })
);

// POST /chatrooms/:id/transfer-owner (owner only)
router.post(
  '/:id/transfer-owner',
  verifyToken,
  requireRoomRank(prisma, RoleRank.OWNER),
  asyncHandler(async (req, res) => {
    const roomId = Number(req.params.id);
    const { newOwnerId } = req.body ?? {};
    if (!Number.isFinite(roomId)) throw Boom.badRequest('Invalid id');
    if (!newOwnerId) throw Boom.badRequest('newOwnerId required');

    const exists = await prisma.participant.findUnique({
      where: { userId_chatRoomId: { userId: Number(newOwnerId), chatRoomId: roomId } },
    });
    if (!exists) throw Boom.badRequest('Target must be a participant');

    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { ownerId: Number(newOwnerId) },
    });

    return res.json({ ok: true });
  })
);

// GET /chatrooms/:id/meta
router.get(
  '/:id/meta',
  verifyToken,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw Boom.badRequest('Invalid id');

    const room = await prisma.chatRoom.findUnique({
      where: { id },
      select: { id: true, name: true, description: true, ownerId: true },
    });
    if (!room) throw Boom.notFound('Not found');

    return res.json(room);
  })
);

// PATCH /chatrooms/:id/meta (owner or admin)
router.patch(
  '/:id/meta',
  verifyToken,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw Boom.badRequest('Invalid id');

    const room = await prisma.chatRoom.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!room) throw Boom.notFound('Not found');

    const me = req.user;
    if (me.role !== 'ADMIN' && me.id !== room.ownerId) {
      throw Boom.forbidden('Forbidden');
    }

    const { description } = req.body ?? {};
    const updated = await prisma.chatRoom.update({
      where: { id },
      data: { description: description ?? null },
      select: { id: true, description: true },
    });

    return res.json(updated);
  })
);

export default router;

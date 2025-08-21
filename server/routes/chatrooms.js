import express from 'express';
import asyncHandler from 'express-async-handler';
import Boom from '@hapi/boom';

import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../utils/prismaClient.js';

// Rank-based helpers (assumes you created these in utils/roomAuth.js)
import {
  requireRoomRank,
  RoleRank,
  getEffectiveRoomRank,
  canActOnRank,
} from '../utils/roomAuth.js';

const router = express.Router();

/** Owner-or-admin guard for a room (global ADMIN bypasses) */
const requireRoomOwner = async (req, _res, next) => {
  const roomId = Number(req.params.id ?? req.body?.chatRoomId);
  if (!Number.isFinite(roomId)) throw Boom.badRequest('Invalid room id');

  const userId = Number(req.user?.id);
  const isAdmin = req.user?.role === 'ADMIN';
  if (isAdmin) return next();

  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    select: { ownerId: true },
  });

  if (!room) throw Boom.notFound('Room not found');
  if (room.ownerId !== userId)
    throw Boom.forbidden('Only the owner can perform this action');

  return next();
};

// GET /chatrooms  (cursor by updatedAt,id; optional membership filter)
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(1, Number(req.query.limit ?? 30)), 100);

    // optional membership filter: only rooms containing userId
    const qUserId = req.query.userId ? Number(req.query.userId) : null;
    const whereBase = qUserId
      ? { participants: { some: { userId: qUserId } } }
      : {};

    // composite cursor: updatedAt + id
    const curIdRaw = req.query.cursorId;
    const curAtRaw = req.query.cursorUpdatedAt;

    let cursorId = null;
    let cursorAt = null;

    if (curIdRaw && curAtRaw) {
      const n = Number(curIdRaw);
      const d = new Date(curAtRaw);
      if (Number.isFinite(n) && !Number.isNaN(d.getTime())) {
        cursorId = n;
        cursorAt = d;
      }
    }

    const where =
      cursorId && cursorAt
        ? {
            ...whereBase,
            OR: [
              { updatedAt: { lt: cursorAt } },
              { updatedAt: cursorAt, id: { lt: cursorId } },
            ],
          }
        : whereBase;

    const items = await prisma.chatRoom.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit,
      include: {
        participants: { include: { user: true } },
      },
    });

    const nextCursor =
      items.length === limit
        ? {
            updatedAt: items[items.length - 1].updatedAt,
            id: items[items.length - 1].id,
          }
        : null;

    return res.json({ items, nextCursor, count: items.length });
  })
);

// POST /chatrooms/direct/:targetUserId
router.post(
  '/direct/:targetUserId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId1 = Number(req.user.id);
    const userId2 = Number(req.params.targetUserId);

    if (
      !Number.isFinite(userId1) ||
      !Number.isFinite(userId2) ||
      userId1 === userId2
    ) {
      throw Boom.badRequest('Invalid or duplicate user IDs');
    }

    const existingRoom = await prisma.chatRoom.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId: userId1 } } },
          { participants: { some: { userId: userId2 } } },
        ],
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

// POST /chatrooms/group  (exact participant-set match check, else create)
router.post(
  '/group',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userIds, name } = req.body || {};
    if (!Array.isArray(userIds) || userIds.length < 2) {
      throw Boom.badRequest('Provide at least 2 user IDs for a group chat');
    }
    const ids = [...new Set(userIds.map(Number))];

    const existing = await prisma.chatRoom.findFirst({
      where: {
        isGroup: true,
        AND: [
          ...ids.map((id) => ({ participants: { some: { userId: id } } })),
          { participants: { every: { userId: { in: ids } } } },
        ],
      },
      include: { participants: true },
    });

    if (existing) return res.json(existing);

    const created = await prisma.chatRoom.create({
      data: {
        name: name || 'Group chat',
        isGroup: true,
        participants: {
          create: ids.map((id) => ({ user: { connect: { id } } })),
        },
      },
      include: { participants: true },
    });

    return res.status(201).json(created);
  })
);

// GET /chatrooms/:id/public-keys
router.get(
  '/:id/public-keys',
  requireAuth,
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

// PATCH /chatrooms/:id/auto-translate  (room admin+)
router.patch(
  '/:id/auto-translate',
  requireAuth,
  requireRoomRank(prisma, RoleRank.ADMIN),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { mode } = req.body ?? {};
    if (!Number.isFinite(id)) throw Boom.badRequest('Invalid id');
    if (!['off', 'tagged', 'all'].includes(mode)) {
      throw Boom.badRequest('invalid mode');
    }

    const updated = await prisma.chatRoom.update({
      where: { id },
      data: { autoTranslateMode: mode },
      select: { id: true, autoTranslateMode: true },
    });

    return res.json(updated);
  })
);

// PATCH /chatrooms/:id/ai-assistant  (owner or global admin)
router.patch(
  '/:id/ai-assistant',
  requireAuth,
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
  requireAuth,
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
  requireAuth,
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

// POST /chatrooms/:id/participants  (admin+)
router.post(
  '/:id/participants',
  requireAuth,
  requireRoomRank(prisma, RoleRank.ADMIN),
  asyncHandler(async (req, res) => {
    const roomId = Number(req.params.id);
    const { userId } = req.body ?? {};
    if (!Number.isFinite(roomId)) throw Boom.badRequest('Invalid id');
    if (!userId) throw Boom.badRequest('userId required');

    const existing = await prisma.participant.findUnique({
      where: {
        userId_chatRoomId: { userId: Number(userId), chatRoomId: roomId },
      },
    });
    if (existing) return res.json({ ok: true });

    const created = await prisma.participant.create({
      data: { userId: Number(userId), chatRoomId: roomId, role: 'MEMBER' },
      select: { userId: true, role: true },
    });

    return res.json({ ok: true, participant: created });
  })
);

// DELETE /chatrooms/:id/participants/:userId (rank ladder)
router.delete(
  '/:id/participants/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const roomId = Number(req.params.id);
    const targetId = Number(req.params.userId);
    if (!Number.isFinite(roomId) || !Number.isFinite(targetId)) {
      throw Boom.badRequest('Invalid id');
    }

    const actorRank = await getEffectiveRoomRank(
      prisma,
      req.user.id,
      roomId,
      req.user.role
    );
    if (actorRank === null || actorRank < RoleRank.MODERATOR) {
      throw Boom.forbidden('Forbidden');
    }

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
    if (!canActOnRank(actorRank, targetRank)) {
      throw Boom.forbidden('Insufficient rank');
    }

    await prisma.participant.delete({
      where: { userId_chatRoomId: { userId: targetId, chatRoomId: roomId } },
    });

    return res.json({ ok: true });
  })
);

// PATCH /chatrooms/:id/participants/:userId/role
// (only owner can grant ADMIN; admins can set MODERATOR/MEMBER)
router.patch(
  '/:id/participants/:userId/role',
  requireAuth,
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

    const actorRank = await getEffectiveRoomRank(
      prisma,
      req.user.id,
      roomId,
      req.user.role
    );
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

    return res.json({ ok: true, participant: updated });
  })
);

// GET /chatrooms/:id/meta
router.get(
  '/:id/meta',
  requireAuth,
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

// PATCH /chatrooms/:id/meta (owner or global admin)
router.patch(
  '/:id/meta',
  requireAuth,
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

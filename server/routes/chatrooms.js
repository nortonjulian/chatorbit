import express from 'express'
import { PrismaClient } from '@prisma/client'
import { verifyToken } from '../middleware/auth.js'
import * as Boom from '@hapi/boom';
import { requireRoomRank, RoleRank } from '../utils/roomAuth.js';

const router = express.Router()
const prisma = new PrismaClient()


async function requireRoomOwner(req, res, next) {
  try {
    const roomId = Number(req.params.id ?? req.body?.chatRoomId);
    if (!Number.isFinite(roomId)) {
      return res.status(400).json({ error: 'Invalid room id' });
    }

    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'ADMIN';
    if (isAdmin) return next(); // admins can manage all rooms

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: { ownerId: true },
    });

    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.ownerId !== userId) {
      return res.status(403).json({ error: 'Only the owner can perform this action' });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

//GET chatrooms
router.get('/', verifyToken, async (req, res) => {
    const { userId } = req.query;

    try {
        const chatRooms = await prisma.chatRoom.findMany({
            where: userId
                ? {
                    participants: { some: { userId: Number(userId) } } }
                : {},
                include: {
                    participants: {
                        include: { user: true }
                    },
                },
                orderBy: { updatedAt: 'desc' },
        })

        res.json(chatRooms)
    } catch (error) {
        console.log('Error fetching chatrooms', error)
        res.status(500).json({ error: 'Failed to fetch chat rooms' })
    }
})

router.post('/direct/:targetUserId', verifyToken, async (req, res) => {
    const userId1 = req.user.id;
    const userId2 = parseInt(req.params.targetUserId, 10);

    if (!userId1 || !userId2 || userId1 === userId2) {
        return res.status(400).json({ error: 'Invalid or duplicate user IDs' });
    }

    try {
        const existingRoom = await prisma.chatRoom.findFirst({
            where: {
                isGroup: false,
                participants: {
                    every: {
                        OR: [
                            { userId: userId1 },
                            { userId: userId2 }
                        ]
                    }
                }
            },
            include: { participants: true }
        });

        if (existingRoom) return res.json(existingRoom);

        const newChatRoom = await prisma.chatRoom.create({
            data: {
                isGroup: false,
                participants: {
                    create: [
                        { user: { connect: { id: userId1 } } },
                        { user: { connect: { id: userId2 } } }
                    ]
                }
            },
            include: { participants: true }
        });

        res.status(201).json(newChatRoom);
    } catch (error) {
        console.log('Error creating or finding chatroom', error);
        res.status(500).json({ error: 'Failed to create/find chatroom' });
    }
});

router.post('/group', verifyToken, async (req, res) => {
    const { userIds, name } = req.body;

    if (!Array.isArray(userIds) || userIds.length < 2) {
        return res.status(400).json({ error: 'Provide at least 2 user IDs for a group chat' })
    }

    try {
        // Step 1: Find chatrooms where ALL userIds are participants
        const possibleRooms = await prisma.chatRoom.findMany({
            where: {
                isGroup: true,
                participants: {
                    every: { userId: { in: userIds.map(Number) } },
                },
            },
            include: { participants: true }
        })

        // Step 2: Filter rooms with EXACTLY the same participants (no extras)
        const matchingRoom = possibleRooms.find((room) => {
            const ids = room.participants.map(p => p.userId).sort()
            const targetIds = [...userIds].map(Number).sort()
            return ids.length === targetIds.length &&
                   ids.every((id, idx) => id === targetIds[idx])
        })

        if (matchingRoom) {
            return res.json(matchingRoom)
        }

        // Step 3: Create a new group chatroom
        const newRoom = await prisma.chatRoom.create({
            data: {
                name: name || 'Group chat',
                isGroup: true,
                participants: {
                    create: userIds.map((id) => ({
                        user: { connect: { id: Number(id) } },
                    })),
                },
            },
            include: { participants: true }
        })

        res.status(201).json(newRoom)
    } catch (error) {
        console.log('Error in group chat creation', error)
        res.status(500).json({ error: 'Failed to create/find group chatroom' })
    }
})

router.get('/:id/public-keys', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const participants = await prisma.participant.findMany({
            where: { chatRoomId: Number(id) },
            include: {
                user: {
                    select: {
                        id: true,
                        publicKey: true,
                        username: true,
                    },
                },
            },
        })

        const keys = participants.map((p) => p,user)
        res.json(keys)
    } catch (error) {
        console.log('Failed to fetch participant keys', error)
        res.status(500).json({ error: 'Failed to fetch keys' })
    }
})

router.patch('/:id/auto-translate', verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  const { mode } = req.body ?? {};
  if (!['off','tagged','all'].includes(mode)) return res.status(400).json({ error: 'invalid mode' });

  // TODO: authorize that req.user is owner/admin of this room
  const updated = await prisma.chatRoom.update({
    where: { id },
    data: { autoTranslateMode: mode },
    select: { id: true, autoTranslateMode: true }
  });
  res.json(updated);
});

router.patch('/:id/ai-assistant', verifyToken, requireRoomOwner, async (req, res) => {
  const { mode } = req.body || {};
  if (!['off','mention','always'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }
  const updated = await prisma.chatRoom.update({
    where: { id: Number(req.params.id) },
    data: { aiAssistantMode: mode },
    select: { id: true, aiAssistantMode: true },
  });
  res.json(updated);
});

router.patch('/:id/ai-opt', verifyToken, async (req, res) => {
  const roomId = Number(req.params.id);
  const { allow } = req.body || {};
  await prisma.participant.update({
    where: { userId_chatRoomId: { userId: req.user.id, chatRoomId: roomId } },
    data: { allowAIBot: !!allow },
  });
  res.json({ ok: true, allowAIBot: !!allow });
});

router.get('/:id/participants', verifyToken, async (req, res, next) => {
  try {
    const list = await prisma.participant.findMany({
      where: { chatRoomId: Number(req.params.id) },
      select: {
        userId: true,
        role: true,
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: [{ role: 'desc' }, { userId: 'asc' }],
    });
    const room = await prisma.chatRoom.findUnique({
      where: { id: Number(req.params.id) },
      select: { ownerId: true },
    });
    res.json({ ownerId: room?.ownerId ?? null, participants: list });
  } catch (e) { next(e); }
});

// Add participant (admins+)
router.post('/:id/participants', verifyToken, requireRoomRank(prisma, RoleRank.ADMIN), async (req, res, next) => {
  try {
    const roomId = Number(req.params.id);
    const { userId } = req.body ?? {};
    if (!userId) throw Boom.badRequest('userId required');

    const existing = await prisma.participant.findUnique({
      where: { userId_chatRoomId: { userId: Number(userId), chatRoomId: roomId } },
    });
    if (existing) return res.json({ ok: true });

    const created = await prisma.participant.create({
      data: { userId: Number(userId), chatRoomId: roomId, role: 'MEMBER' },
      select: { userId: true, role: true },
    });

    // optional: io.to(roomId).emit('room:member_added', { userId })
    res.json({ ok: true, participant: created });
  } catch (e) { next(e); }
});

// Remove participant (moderators+ can remove members; only admins/owner can remove mods; only owner can remove admins)
router.delete('/:id/participants/:userId', verifyToken, async (req, res, next) => {
  try {
    const roomId = Number(req.params.id);
    const targetId = Number(req.params.userId);

    const actorRank = await getEffectiveRoomRank(prisma, req.user.id, roomId);
    if (actorRank < RoleRank.MODERATOR) return res.status(403).json({ error: 'Forbidden' });

    // Fetch target participant’s rank
    const room = await prisma.chatRoom.findUnique({ where: { id: roomId }, select: { ownerId: true }});
    if (!room) throw Boom.notFound('Room not found');
    if (room.ownerId === targetId) return res.status(403).json({ error: 'Cannot remove owner' });

    const target = await prisma.participant.findUnique({
      where: { userId_chatRoomId: { userId: targetId, chatRoomId: roomId } },
      select: { role: true },
    });
    if (!target) return res.json({ ok: true });

    const targetRank = RoleRank[target.role] ?? RoleRank.MEMBER;

    // moderation ladder rules
    const canKick =
      (actorRank >= RoleRank.OWNER) ||
      (actorRank >= RoleRank.ADMIN && targetRank <= RoleRank.MODERATOR) ||
      (actorRank >= RoleRank.MODERATOR && targetRank <= RoleRank.MEMBER);

    if (!canKick) return res.status(403).json({ error: 'Insufficient rank' });

    await prisma.participant.delete({
      where: { userId_chatRoomId: { userId: targetId, chatRoomId: roomId } },
    });

    // optional: io.to(roomId).emit('room:member_removed', { userId: targetId })
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Change role (only owner can set ADMIN; admins can set MODERATOR/MEMBER)
router.patch('/:id/participants/:userId/role', verifyToken, async (req, res, next) => {
  try {
    const roomId = Number(req.params.id);
    const targetId = Number(req.params.userId);
    const { role } = req.body ?? {}; // 'ADMIN' | 'MODERATOR' | 'MEMBER'

    if (!['ADMIN', 'MODERATOR', 'MEMBER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId }, select: { ownerId: true }
    });
    if (!room) throw Boom.notFound('Room not found');

    const actorRank = await getEffectiveRoomRank(prisma, req.user.id, roomId);
    if (actorRank < RoleRank.ADMIN) return res.status(403).json({ error: 'Forbidden' });

    if (role === 'ADMIN' && actorRank < RoleRank.OWNER) {
      return res.status(403).json({ error: 'Only owner can grant ADMIN' });
    }

    if (room.ownerId === targetId) {
      return res.status(403).json({ error: 'Cannot change owner role' });
    }

    const updated = await prisma.participant.update({
      where: { userId_chatRoomId: { userId: targetId, chatRoomId: roomId } },
      data: { role },
      select: { userId: true, role: true },
    });

    // optional: io.to(roomId).emit('room:role_changed', updated)
    res.json({ ok: true, participant: updated });
  } catch (e) { next(e); }
});

// Optional: transfer ownership (owner only)
router.post('/:id/transfer-owner', verifyToken, requireRoomRank(prisma, RoleRank.OWNER), async (req, res, next) => {
  try {
    const roomId = Number(req.params.id);
    const { newOwnerId } = req.body ?? {};
    if (!newOwnerId) return res.status(400).json({ error: 'newOwnerId required' });

    // ensure target is participant
    const exists = await prisma.participant.findUnique({
      where: { userId_chatRoomId: { userId: Number(newOwnerId), chatRoomId: roomId } },
    });
    if (!exists) return res.status(400).json({ error: 'Target must be a participant' });

    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { ownerId: Number(newOwnerId) },
    });

    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/:id/meta', verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  const room = await prisma.chatRoom.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, ownerId: true }
  });
  if (!room) return res.status(404).json({ error: 'Not found' });
  res.json(room);
});

// PATCH description (owner or admin)
router.patch('/:id/meta', verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  const me = req.user;
  const room = await prisma.chatRoom.findUnique({ where: { id }, select: { ownerId: true } });
  if (!room) return res.status(404).json({ error: 'Not found' });
  if (me.role !== 'ADMIN' && me.id !== room.ownerId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { description } = req.body ?? {};
  const updated = await prisma.chatRoom.update({
    where: { id },
    data: { description: description ?? null },
    select: { id: true, description: true }
  });
  res.json(updated);
});


export default router
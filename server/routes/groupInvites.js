import express from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = express.Router();

// helper: only owner/admins can manage invites
async function assertCanManageRoom(roomId, userId) {
  const room = await prisma.chatRoom.findUnique({
    where: { id: Number(roomId) },
    select: {
      ownerId: true,
      participants: { where: { userId: Number(userId) }, select: { role: true } },
    },
  });
  if (!room) throw Object.assign(new Error('Room not found'), { status: 404 });
  const myRole = room.participants[0]?.role;
  const can = room.ownerId === Number(userId) || myRole === 'ADMIN';
  if (!can) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
}

// short code
function makeCode(len = 10) {
  return crypto.randomBytes(len).toString('base64url'); // URL-safe
}

// Create invite
router.post('/chatrooms/:roomId/invites', verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    await assertCanManageRoom(roomId, req.user.id);

    const { maxUses = 0, expiresInMinutes = 60 * 24 } = req.body ?? {};
    const code = makeCode(8);

    const invite = await prisma.chatRoomInvite.create({
      data: {
        code,
        chatRoomId: Number(roomId),
        createdById: req.user.id,
        maxUses: Number(maxUses) || 0,
        expiresAt:
          expiresInMinutes > 0 ? new Date(Date.now() + expiresInMinutes * 60 * 1000) : null,
      },
      select: { code: true, expiresAt: true, maxUses: true, usedCount: true },
    });

    const baseUrl = process.env.APP_BASE_URL || process.env.WEB_URL || 'http://localhost:5173';
    const url = `${baseUrl}/join/${invite.code}`;

    res.json({ ...invite, url });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Failed to create invite' });
  }
});

// List invites
router.get('/chatrooms/:roomId/invites', verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    await assertCanManageRoom(roomId, req.user.id);

    const list = await prisma.chatRoomInvite.findMany({
      where: { chatRoomId: Number(roomId) },
      orderBy: { createdAt: 'desc' },
      select: {
        code: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
    res.json(list);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Failed to list invites' });
  }
});

// Revoke invite
router.delete('/chatrooms/:roomId/invites/:code', verifyToken, async (req, res) => {
  try {
    const { roomId, code } = req.params;
    await assertCanManageRoom(roomId, req.user.id);
    await prisma.chatRoomInvite.update({
      where: { code },
      data: { revokedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Failed to revoke invite' });
  }
});

// Resolve invite (preview)
router.get('/invites/:code', async (req, res) => {
  const { code } = req.params;
  const inv = await prisma.chatRoomInvite.findUnique({
    where: { code },
    select: {
      code: true,
      expiresAt: true,
      maxUses: true,
      usedCount: true,
      revokedAt: true,
      chatRoom: { select: { id: true, name: true } },
    },
  });
  if (!inv) return res.status(404).json({ error: 'Invite not found' });

  const expired = inv.expiresAt && new Date(inv.expiresAt) < new Date();
  const exhausted = inv.maxUses > 0 && inv.usedCount >= inv.maxUses;
  const revoked = !!inv.revokedAt;

  res.json({
    code: inv.code,
    roomId: inv.chatRoom.id,
    roomName: inv.chatRoom.name,
    status: revoked ? 'revoked' : expired ? 'expired' : exhausted ? 'exhausted' : 'ok',
  });
});

// Accept invite (join room)
router.post('/invites/:code/accept', verifyToken, async (req, res) => {
  const { code } = req.params;
  const inv = await prisma.chatRoomInvite.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      expiresAt: true,
      maxUses: true,
      usedCount: true,
      revokedAt: true,
      chatRoomId: true,
    },
  });
  if (!inv) return res.status(404).json({ error: 'Invite not found' });
  if (inv.revokedAt) return res.status(410).json({ error: 'Invite revoked' });
  if (inv.expiresAt && new Date(inv.expiresAt) < new Date())
    return res.status(410).json({ error: 'Invite expired' });
  if (inv.maxUses > 0 && inv.usedCount >= inv.maxUses)
    return res.status(410).json({ error: 'Invite exhausted' });

  // upsert participant as MEMBER
  await prisma.participant.upsert({
    where: { chatRoomId_userId: { chatRoomId: inv.chatRoomId, userId: req.user.id } },
    create: { chatRoomId: inv.chatRoomId, userId: req.user.id, role: 'MEMBER' },
    update: {},
  });

  await prisma.chatRoomInvite.update({
    where: { code },
    data: { usedCount: { increment: 1 } },
  });

  res.json({ ok: true, roomId: inv.chatRoomId });
});

export default router;

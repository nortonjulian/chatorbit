import express from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = express.Router();

// GET /admin/reports?status=OPEN&take=50&skip=0
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const take = Math.min(parseInt(req.query.take ?? '50', 10), 200);
    const skip = parseInt(req.query.skip ?? '0', 10);
    const status = (req.query.status ?? '').toString().toUpperCase();

    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take, skip,
        include: {
          reporter: { select: { id: true, username: true, email: true } },
          message: {
            select: {
              id: true,
              rawContent: true,
              translatedContent: true,
              chatRoomId: true,
              createdAt: true,
              sender: { select: { id: true, username: true, isBanned: true } },
            },
          },
        },
      }),
      prisma.report.count({ where }),
    ]);

    res.json({ items, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

// PATCH /admin/reports/:id/resolve
router.patch('/:id/resolve', verifyToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { notes } = req.body || {};
    const updated = await prisma.report.update({
      where: { id },
      data: { status: 'RESOLVED', notes: notes || null, resolvedAt: new Date() },
    });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

// POST /admin/reports/users/:userId/warn
router.post('/users/:userId/warn', verifyToken, requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { notes } = req.body || {};
    // (Optional) Persist a warning model or AuditLog here
    res.json({ success: true, userId, notes: notes || 'warned' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to warn user' });
  }
});

// POST /admin/reports/users/:userId/ban
router.post('/users/:userId/ban', verifyToken, requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { reason } = req.body || {};
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isBanned: true, bannedAt: new Date() },
    });
    res.json({ success: true, user: { id: updated.id, isBanned: updated.isBanned }, reason: reason || '' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// DELETE /admin/reports/messages/:messageId
router.delete('/messages/:messageId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const messageId = Number(req.params.messageId);
    await prisma.message.update({
      where: { id: messageId },
      data: { deletedBySender: true },
    });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;

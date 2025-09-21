import express from 'express';
import Boom from '@hapi/boom';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../utils/prismaClient.js';

const router = express.Router();

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'test' ? 'test_secret' : 'dev_secret');
const COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'orbit_jwt';

// Router-level guard
router.use(requireAuth);

/**
 * GET /backups/export
 */
router.get('/export', async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Unauthorized' });
    const userId = Number(req.user.id);

    let me = null;
    try {
      me = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, username: true, createdAt: true, plan: true },
      });
    } catch {
      me = { id: userId, email: req.user.email || null, username: req.user.username || null, plan: req.user.plan || 'FREE' };
    }

    let rooms = [];
    try {
      rooms = await prisma.chatRoom.findMany({
        where: { participants: { some: { userId } } },
        select: { id: true, name: true, isGroup: true, createdAt: true },
      });
    } catch {}

    let messages = [];
    try {
      messages = await prisma.message.findMany({
        where: { OR: [{ senderId: userId }, { authorId: userId }, { sender: { id: userId } }] },
        select: { id: true, rawContent: true, createdAt: true, chatRoomId: true },
        take: 1000,
      });
    } catch {}

    const payload = { user: me, rooms, messages, exportedAt: new Date().toISOString() };

    res
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Content-Disposition', 'attachment; filename="backup.json"')
      .status(200)
      .send(JSON.stringify(payload));
  } catch (e) {
    next(e.isBoom ? e : Boom.badRequest(e.message || 'Export failed'));
  }
});

export default router;

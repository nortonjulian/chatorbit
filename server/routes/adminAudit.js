import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/auth.js';


const prisma = new PrismaClient();
const router = express.Router();
router.use(requireAuth, requireAdmin);

// GET /admin/audit?actorId=&action=&take=&skip=
router.get('/', async (req, res) => {
  try {
    const take = Math.min(parseInt(req.query.take ?? '50', 10), 200);
    const skip = parseInt(req.query.skip ?? '0', 10);
    const { actorId, action } = req.query;

    const where = {
      ...(actorId ? { actorId: Number(actorId) } : {}),
      ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, username: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ items, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;

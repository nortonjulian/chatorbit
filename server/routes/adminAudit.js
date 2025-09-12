import express from 'express';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireAdmin);

// GET /admin/audit?actorId=&action=&take=&skip=
router.get('/', async (req, res) => {
  try {
    const take = Math.min(parseInt(req.query.take ?? '50', 10), 500);
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
        include: {
          actor: { select: { id: true, username: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ items, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET /admin/audit/export.csv?actorId=&action=
router.get('/export.csv', async (req, res) => {
  try {
    const { actorId, action } = req.query;

    const where = {
      ...(actorId ? { actorId: Number(actorId) } : {}),
      ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
    };

    const items = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000, // cap export size
      include: {
        actor: { select: { id: true, username: true, role: true } },
      },
    });

    const header = [
      'id',
      'createdAt',
      'action',
      'actorId',
      'actorUsername',
      'actorRole',
      'targetUserId',
      'targetMessageId',
      'targetReportId',
      'notes',
    ];

    const rows = items.map((i) => [
      i.id,
      i.createdAt.toISOString(),
      i.action,
      i.actorId ?? '',
      i.actor?.username ?? '',
      i.actor?.role ?? '',
      i.targetUserId ?? '',
      i.targetMessageId ?? '',
      i.targetReportId ?? '',
      (typeof i.notes === 'string' ? i.notes : JSON.stringify(i.notes ?? '')),
    ]);

    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-export.csv"');
    res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to export audit CSV' });
  }
});

export default router;

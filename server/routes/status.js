import express from 'express';
import multer from 'multer';
import Boom from '@hapi/boom';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../utils/prismaClient.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createStatusService } from '../services/statusService.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

/**
 * POST /status  (create)
 * Body fields:
 *  - caption?: string
 *  - audience?: 'MUTUALS'|'FOLLOWERS'|'PUBLIC'|'CUSTOM'
 *  - customAudienceIds?: JSON string [userId,...]
 *  - expireSeconds?: number (default 24h)
 *  - attachmentsInline?: JSON string [{ kind, url, ... }]
 * Files: files[] (up to 5)
 */
router.post(
  '/',
  verifyToken,
  upload.array('files', 5),
  asyncHandler(async (req, res) => {
    const authorId = req.user.id;
    const {
      caption,
      audience = 'MUTUALS',
      customAudienceIds,
      expireSeconds,
      attachmentsInline,
    } = req.body || {};

    // Uploads → assets
    const uploaded = (req.files || []).map((f) => {
      const mt = f.mimetype || '';
      const kind = mt.startsWith('image/')
        ? 'IMAGE'
        : mt.startsWith('video/')
          ? 'VIDEO'
          : mt.startsWith('audio/')
            ? 'AUDIO'
            : 'FILE';
      return { kind, url: `/uploads/${f.filename}`, mimeType: mt };
    });

    // Inline assets (stickers/GIF/remote)
    let inline = [];
    try {
      inline = JSON.parse(attachmentsInline || '[]') || [];
    } catch {}
    inline = inline.map((a) => ({
      kind: a.kind,
      url: a.url,
      mimeType: a.mimeType || '',
      width: a.width ?? null,
      height: a.height ?? null,
      durationSec: a.durationSec ?? null,
      caption: a.caption ?? null,
    }));

    // Custom audience ids
    let customIds = [];
    try {
      customIds = JSON.parse(customAudienceIds || '[]') || [];
    } catch {}

    const saved = await createStatusService({
      authorId,
      caption,
      files: [...uploaded, ...inline],
      audience,
      customAudienceIds: customIds,
      expireSeconds: Number(expireSeconds) || 24 * 3600,
    });

    // Notify author's devices (joined to room `user:{id}` via socket)
    req.app.get('io')?.to(`user:${authorId}`).emit('status_posted', {
      id: saved.id,
      authorId,
    });

    return res.status(201).json(saved);
  })
);

/**
 * GET /status/:id
 * Returns the status + aggregated reactionSummary (emoji -> count)
 */
router.get(
  '/:id',
  verifyToken,
  asyncHandler(async (req, res) => {
    const statusId = Number(req.params.id);
    if (!Number.isFinite(statusId)) throw Boom.badRequest('Invalid id');

    const status = await prisma.status.findUnique({
      where: { id: statusId },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        assets: true,
      },
    });
    if (!status) throw Boom.notFound('Not found');

    const reactionGroups = await prisma.statusReaction.groupBy({
      by: ['emoji'],
      where: { statusId },
      _count: { emoji: true },
    });
    const reactionSummary = Object.fromEntries(
      reactionGroups.map((r) => [r.emoji, r._count.emoji])
    );

    return res.json({ ...status, reactionSummary });
  })
);

/**
 * GET /status/feed?limit=20&cursor=<id>
 * Returns { items, nextCursor } for active (non-expired) stories
 * Only items the viewer can decrypt (via StatusKey).
 */
router.get(
  '/feed',
  verifyToken,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const limit = Math.min(Math.max(1, Number(req.query.limit ?? 20)), 50);
    const cursor = req.query.cursor ? Number(req.query.cursor) : null;

    // Fetch a page of visible statuses for this viewer
    const items = await prisma.status.findMany({
      where: {
        expiresAt: { gt: new Date() },
        keys: { some: { userId } },
      },
      orderBy: { id: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        authorId: true,
        createdAt: true,
        expiresAt: true,
        captionCiphertext: true,
        assets: true,
        author: { select: { id: true, username: true, avatarUrl: true } },
        keys: { where: { userId }, select: { encryptedKey: true } },
        views: { where: { viewerId: userId }, select: { id: true } },
      },
    });

    const ids = items.map((s) => s.id);

    // Aggregate reactions in SQL, then fold into a map
    let reactionSummaryByStatus = {};
    if (ids.length) {
      const grouped = await prisma.statusReaction.groupBy({
        by: ['statusId', 'emoji'],
        where: { statusId: { in: ids } },
        _count: { emoji: true },
      });
      reactionSummaryByStatus = grouped.reduce((acc, r) => {
        (acc[r.statusId] ||= {})[r.emoji] = r._count.emoji;
        return acc;
      }, {});
    }

    const shaped = items.map((s) => ({
      id: s.id,
      author: s.author,
      assets: s.assets,
      captionCiphertext: s.captionCiphertext,
      encryptedKeyForMe: s.keys?.[0]?.encryptedKey ?? null,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
      viewerSeen: s.views.length > 0,
      reactionSummary: reactionSummaryByStatus[s.id] || {},
    }));

    const nextCursor = shaped.length === limit ? shaped[shaped.length - 1].id : null;

    return res.json({ items: shaped, nextCursor });
  })
);

/**
 * PATCH /status/:id/view
 * Marks a status as viewed by current user (idempotent)
 */
router.patch(
  '/:id/view',
  verifyToken,
  asyncHandler(async (req, res) => {
    const statusId = Number(req.params.id);
    if (!Number.isFinite(statusId)) throw Boom.badRequest('Invalid id');

    const viewerId = req.user.id;

    await prisma.statusView.upsert({
      where: { statusId_viewerId: { statusId, viewerId } },
      update: {},
      create: { statusId, viewerId },
    });

    const author = await prisma.status.findUnique({
      where: { id: statusId },
      select: { authorId: true },
    });
    if (author) {
      req.app.get('io')?.to(`user:${author.authorId}`).emit('status_viewed', {
        statusId,
        viewerId,
      });
    }

    return res.json({ ok: true });
  })
);

/**
 * POST /status/:id/reactions  (toggle)
 * Body: { emoji }
 */
router.post(
  '/:id/reactions',
  verifyToken,
  asyncHandler(async (req, res) => {
    const statusId = Number(req.params.id);
    const userId = req.user.id;
    const { emoji } = req.body || {};
    if (!Number.isFinite(statusId)) throw Boom.badRequest('Invalid id');
    if (!emoji || typeof emoji !== 'string') throw Boom.badRequest('emoji required');

    const existing = await prisma.statusReaction.findUnique({
      where: { statusId_userId_emoji: { statusId, userId, emoji } },
    });

    if (existing) {
      await prisma.statusReaction.delete({
        where: { statusId_userId_emoji: { statusId, userId, emoji } },
      });

      // Recompute count for this emoji (optional but nice)
      const count = await prisma.statusReaction.count({
        where: { statusId, emoji },
      });
      return res.json({ ok: true, op: 'removed', emoji, count });
    }

    await prisma.statusReaction.create({ data: { statusId, userId, emoji } });
    const count = await prisma.statusReaction.count({
      where: { statusId, emoji },
    });
    return res.json({ ok: true, op: 'added', emoji, count });
  })
);

/**
 * DELETE /status/:id
 * Only author (or global ADMIN) can delete.
 */
router.delete(
  '/:id',
  verifyToken,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw Boom.badRequest('Invalid id');

    const s = await prisma.status.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!s) throw Boom.notFound('Not found');
    if (req.user.role !== 'ADMIN' && s.authorId !== req.user.id) {
      throw Boom.forbidden('Forbidden');
    }

    await prisma.status.delete({ where: { id } });
    return res.json({ ok: true });
  })
);

export default router;

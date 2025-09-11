import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../utils/prismaClient.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createStatusService } from '../services/statusService.js';

const router = express.Router();

if (process.env.NODE_ENV !== 'production') {
  const _get = router.get.bind(router);
  const _post = router.post.bind(router);
  const _patch = router.patch.bind(router);
  router.get = (p, ...h) => { console.log('[status] GET', p); return _get(p, ...h); };
  router.post = (p, ...h) => { console.log('[status] POST', p); return _post(p, ...h); };
  router.patch = (p, ...h) => { console.log('[status] PATCH', p); return _patch(p, ...h); };
}

const upload = multer({ dest: 'uploads/' });

/**
 * POST /status  (create)
 */
router.get('/__iam_status_router', (_req, res) => {
  res.json({ ok: true, router: 'status' });
});

router.post(
  '/',
  requireAuth,
  upload.array('files', 5),
  asyncHandler(async (req, res) => {
    const authorId = req.user.id;
    let {
      caption,
      audience = 'MUTUALS',
      customAudienceIds,
      expireSeconds,
      attachmentsInline,
    } = req.body || {};

    // Normalize some aliases from UI/curl
    const A = String(audience || '').toUpperCase();
    if (A === 'FRIENDS') audience = 'MUTUALS';
    else if (['MUTUALS', 'CONTACTS', 'CUSTOM', 'PUBLIC'].includes(A)) audience = A;
    else audience = 'MUTUALS';

    // Uploads → assets (demo local storage; swap to R2/S3 if desired)
    const uploaded = (req.files || []).map((f) => {
      const mt = f.mimetype || '';
      const kind =
        mt.startsWith('image/') ? 'IMAGE' :
        mt.startsWith('video/') ? 'VIDEO' :
        mt.startsWith('audio/') ? 'AUDIO' : 'FILE';
      return { kind, url: `/uploads/${f.filename}`, mimeType: mt };
    });

    // Inline assets (stickers/GIF/remote)
    let inline = [];
    try { inline = JSON.parse(attachmentsInline || '[]') || []; } catch {}
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
    try { customIds = JSON.parse(customAudienceIds || '[]') || []; } catch {}

    let saved;
    try {
      saved = await createStatusService({
        authorId,
        caption,
        files: [...uploaded, ...inline],
        audience,
        customAudienceIds: customIds,
        expireSeconds: Number(expireSeconds) || 24 * 3600,
      });
    } catch (e) {
      const msg = String(e?.message || '');
      if (/No audience/i.test(msg)) {
        return res.status(400).json({ error: 'No audience (try CUSTOM or PUBLIC while testing)' });
      }
      return res.status(400).json({ error: msg || 'Bad request' });
    }

    // Notify author's devices (joined to room `user:{id}` via socket)
    const io = req.app.get('io');
    io?.to(`user:${authorId}`).emit('status_posted', {
      id: saved.id,
      authorId,
    });

    // ALSO notify each audience recipient (if we have keys generated)
    try {
      const keys = await prisma.statusKey.findMany({
        where: { statusId: saved.id },
        select: { userId: true },
      });
      const audienceUserIds = keys.map(k => k.userId).filter(uid => uid !== authorId);
      for (const uid of audienceUserIds) {
        io?.to(`user:${uid}`).emit('status_posted', { id: saved.id, authorId });
      }
    } catch {}

    return res.status(201).json(saved);
  })
);

/**
 * Helper visibility checks
 */
async function isFollower({ viewerId, authorId }) {
  const rel = await prisma.follow.findFirst({
    where: { followerId: viewerId, followeeId: authorId, accepted: true },
    select: { id: true },
  });
  return !!rel;
}

async function isMutual({ viewerId, authorId }) {
  const [a, b] = await Promise.all([
    prisma.follow.findFirst({
      where: { followerId: viewerId, followeeId: authorId, accepted: true },
      select: { id: true },
    }),
    prisma.follow.findFirst({
      where: { followerId: authorId, followeeId: viewerId, accepted: true },
      select: { id: true },
    }),
  ]);
  return !!a && !!b;
}

/**
 * GET /status/feed
 */
router.get(
  '/feed',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const limit = Math.min(Math.max(1, Number(req.query.limit ?? 20)), 50);
    const cursor = req.query.cursor ? Number(req.query.cursor) : null;

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
 * GET /status/:id
 */
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const statusId = Number(req.params.id);
    if (!Number.isFinite(statusId)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const status = await prisma.status.findUnique({
      where: { id: statusId },
      select: {
        id: true,
        authorId: true,
        audience: true, // 'MUTUALS'|'FRIENDS'|'CONTACTS'|'PUBLIC'|'CUSTOM'|'FOLLOWERS'
        createdAt: true,
        expiresAt: true,
        captionCiphertext: true,
        assets: true,
        author: { select: { id: true, username: true, avatarUrl: true } },
        keys: { select: { userId: true, encryptedKey: true } },
      },
    });
    if (!status) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Expired?
    if (status.expiresAt && status.expiresAt <= new Date()) {
      return res.status(404).json({ error: 'Not found' });
    }

    const me = req.user;
    const isOwner = status.authorId === me.id;
    const isAdmin = me.role === 'ADMIN';
    const hasKey = Array.isArray(status.keys) && status.keys.some(k => k.userId === me.id);

    let allowed = false;

    if (isOwner || isAdmin) {
      allowed = true;
    } else if (status.audience === 'PUBLIC') {
      allowed = true;
    } else if (status.audience === 'FOLLOWERS') {
      allowed = await isFollower({ viewerId: me.id, authorId: status.authorId });
    } else if (status.audience === 'MUTUALS' || status.audience === 'FRIENDS') {
      allowed = await isMutual({ viewerId: me.id, authorId: status.authorId });
    } else if (status.audience === 'CUSTOM') {
      // For CUSTOM, enforce via presence of a StatusKey for the viewer
      allowed = hasKey;
    }

    // Optional defense-in-depth: for non-public, ensure viewer has a key
    if (allowed && !isOwner && !isAdmin && status.audience !== 'PUBLIC') {
      if (!hasKey) allowed = false;
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Aggregate reactions
    const reactionGroups = await prisma.statusReaction.groupBy({
      by: ['emoji'],
      where: { statusId },
      _count: { emoji: true },
    });
    const reactionSummary = Object.fromEntries(
      reactionGroups.map((r) => [r.emoji, r._count.emoji])
    );

    return res.json({
      id: status.id,
      author: status.author,
      assets: status.assets,
      captionCiphertext: status.captionCiphertext,
      encryptedKeyForMe:
        status.keys?.find((k) => k.userId === me.id)?.encryptedKey ?? null,
      expiresAt: status.expiresAt,
      createdAt: status.createdAt,
      reactionSummary,
    });
  })
);

/**
 * PATCH /status/:id/view
 */
router.patch('/:id/view', requireAuth, asyncHandler(async (req, res) => {
  const statusId = Number(req.params.id);
  if (!Number.isInteger(statusId) || statusId <= 0) {
    return res.status(400).json({ error: 'Invalid status id' });
  }

  const status = await prisma.status.findUnique({
    where: { id: statusId },
    select: {
      id: true,
      authorId: true,
      audience: true,
      expiresAt: true,
      keys: { select: { userId: true } },
    },
  });
  if (!status) return res.status(404).json({ error: 'Status not found' });
  if (status.expiresAt && status.expiresAt <= new Date()) {
    return res.status(404).json({ error: 'Status not found' });
  }

  const me = req.user;
  const isOwner = status.authorId === me.id;
  const isAdmin = me.role === 'ADMIN';
  const hasKey = Array.isArray(status.keys) && status.keys.some(k => k.userId === me.id);

  let allowed = false;
  if (isOwner || isAdmin) {
    allowed = true;
  } else if (status.audience === 'PUBLIC') {
    allowed = true;
  } else {
    // For non-public, require key (feed parity)
    allowed = hasKey;
  }
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });

  await prisma.statusView.upsert({
    where: { statusId_viewerId: { statusId, viewerId: me.id } },
    update: {},
    create: { statusId, viewerId: me.id },
  });

  req.app.get('io')?.to(`user:${status.authorId}`).emit('status_viewed', {
    statusId,
    viewerId: me.id,
  });

  return res.status(204).end();
}));

/**
 * POST /status/:id/reactions
 */
router.post(
  '/:id/reactions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const statusId = Number(req.params.id);
    const userId = req.user.id;
    const emoji = String(req.body?.emoji || '').slice(0, 16);

    if (!Number.isInteger(statusId) || statusId <= 0) {
      return res.status(400).json({ error: 'Invalid status id' });
    }
    if (!emoji) return res.status(400).json({ error: 'Missing emoji' });

    const status = await prisma.status.findUnique({
      where: { id: statusId },
      select: {
        id: true,
        authorId: true,
        audience: true,
        expiresAt: true,
        keys: { select: { userId: true } },
      },
    });
    if (!status) return res.status(404).json({ error: 'Status not found' });
    if (status.expiresAt && status.expiresAt <= new Date()) {
      return res.status(404).json({ error: 'Status not found' });
    }

    const me = req.user;
    const isOwner = status.authorId === me.id;
    const isAdmin = me.role === 'ADMIN';
    const hasKey = Array.isArray(status.keys) && status.keys.some(k => k.userId === me.id);

    let allowed = false;
    if (isOwner || isAdmin) {
      allowed = true;
    } else if (status.audience === 'PUBLIC') {
      allowed = true;
    } else {
      // For non-public, require key (feed parity)
      allowed = hasKey;
    }
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    try {
      const existing = await prisma.statusReaction.findUnique({
        where: { statusId_userId_emoji: { statusId, userId, emoji } },
      });

      if (existing) {
        await prisma.statusReaction.delete({
          where: { statusId_userId_emoji: { statusId, userId, emoji } },
        });
        const count = await prisma.statusReaction.count({ where: { statusId, emoji } });
        return res.json({ ok: true, op: 'removed', emoji, count });
      }

      await prisma.statusReaction.create({ data: { statusId, userId, emoji } });
      const count = await prisma.statusReaction.count({ where: { statusId, emoji } });
      return res.json({ ok: true, op: 'added', emoji, count });
    } catch (e) {
      if (e?.code === 'P2003') {
        return res.status(404).json({ error: 'Status not found' });
      }
      throw e;
    }
  })
);

/**
 * DELETE /status/:id
 */
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const s = await prisma.status.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!s) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (req.user.role !== 'ADMIN' && s.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get recipients BEFORE delete so we can notify them
    const keys = await prisma.statusKey.findMany({
      where: { statusId: id },
      select: { userId: true },
    });
    const audienceUserIds = keys.map(k => k.userId).filter(uid => uid !== s.authorId);

    await prisma.status.delete({ where: { id } });

    const io = req.app.get('io');
    io?.to(`user:${s.authorId}`).emit('status_deleted', { id });

    for (const uid of audienceUserIds) {
      io?.to(`user:${uid}`).emit('status_deleted', { id });
    }

    return res.json({ ok: true });
  })
);

export default router;

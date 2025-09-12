import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../utils/prismaClient.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createStatusService } from '../services/statusService.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// health probe
router.get('/__iam_status_router', (_req, res) => res.json({ ok: true, router: 'status' }));

/**
 * POST /status  (create)
 */
router.post(
  '/',
  requireAuth,
  upload.array('files', 5),
  asyncHandler(async (req, res) => {
    const authorId = Number(req.user.id);

    let {
      audience = 'MUTUALS',
      caption,
      content,                 // alias used by tests
      customAudienceIds,
      expireSeconds,
      attachmentsInline,
    } = req.body || {};
    if (!caption && typeof content === 'string') caption = content;

    // Map public alias to Prisma enum
    const A = String(audience || '').toUpperCase();
    if (A === 'FRIENDS') audience = 'MUTUALS';
    else if (A === 'PUBLIC') audience = 'EVERYONE';
    else if (['MUTUALS', 'CONTACTS', 'CUSTOM', 'EVERYONE', 'FOLLOWERS'].includes(A)) audience = A;
    else audience = 'MUTUALS';

    const uploaded = (req.files || []).map((f) => {
      const mt = f.mimetype || '';
      const kind =
        mt.startsWith('image/') ? 'IMAGE' :
        mt.startsWith('video/') ? 'VIDEO' :
        mt.startsWith('audio/') ? 'AUDIO' : 'FILE';
      return { kind, url: `/uploads/${f.filename}`, mimeType: mt };
    });

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

    let customIds = [];
    try { customIds = JSON.parse(customAudienceIds || '[]') || []; } catch {}
    if (audience === 'CUSTOM' && (!Array.isArray(customIds) || customIds.length === 0)) {
      customIds = [authorId]; // CUSTOM [self]
    }

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
      return res.status(400).json({ error: e?.message || 'Bad request' });
    }

    const io = req.app.get('io');
    io?.to(`user:${authorId}`).emit('status_posted', { id: saved.id, authorId });
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
 * GET /status/feed?tab=all|following|contacts&limit=&cursor=
 */
router.get(
  '/feed',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = Number(req.user.id);
    const limit = Math.min(Math.max(1, Number(req.query.limit ?? 20)), 50);
    const cursor = req.query.cursor ? Number(req.query.cursor) : null;
    const tab = String(req.query.tab || 'all').toLowerCase();

    let contactIds = [];
    let followingIds = [];

    if (tab === 'contacts') {
      const contacts = await prisma.contact.findMany({
        where: { ownerId: userId },
        select: { contactUserId: true },
      });
      contactIds = contacts.map((c) => c.contactUserId);
      if (!contactIds.length) return res.json({ items: [], nextCursor: null });
    }

    if (tab === 'following') {
      const following = await prisma.follow.findMany({
        where: { followerId: userId, accepted: true },
        select: { followeeId: true },
      });
      followingIds = following.map((f) => f.followeeId);
      if (!followingIds.length) return res.json({ items: [], nextCursor: null });
    }

    // Pre-fetch status IDs for which I have a key
    const myKeyRows = await prisma.statusKey.findMany({
      where: { userId },
      select: { statusId: true },
    });
    const idsWithKey = new Set(myKeyRows.map((r) => r.statusId));

    const whereAny = {
      expiresAt: { gt: new Date() },
      OR: [
        { authorId: userId },
        { audience: 'EVERYONE' }, // <-- PUBLIC -> EVERYONE
        idsWithKey.size ? { id: { in: Array.from(idsWithKey) } } : { id: -1 },
      ],
    };

    const where =
      tab === 'following'
        ? { AND: [whereAny, { OR: [{ authorId: userId }, { authorId: { in: followingIds } }] }] }
        : tab === 'contacts'
        ? { AND: [whereAny, { OR: [{ authorId: userId }, { authorId: { in: contactIds } }] }] }
        : whereAny;

    const items = await prisma.status.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        authorId: true,
        audience: true,
        createdAt: true,
        expiresAt: true,
        captionCiphertext: true,
        assets: true,
        author: { select: { id: true, username: true, avatarUrl: true } },
        views: { where: { viewerId: userId }, select: { id: true } },
      },
    });

    // Keys for *these* items
    const ids = items.map((s) => s.id);
    const myKeys = ids.length
      ? await prisma.statusKey.findMany({
          where: { statusId: { in: ids }, userId },
          select: { statusId: true, encryptedKey: true },
        })
      : [];
    const keyByStatus = myKeys.reduce((m, r) => (m[r.statusId] = r.encryptedKey, m), {});

    const shaped = items.map((s) => ({
      id: s.id,
      author: s.author,
      audience: s.audience,
      assets: s.assets,
      captionCiphertext: s.captionCiphertext,
      encryptedKeyForMe: keyByStatus[s.id] ?? null,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
      viewerSeen: s.views.length > 0,
      reactionSummary: {},
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
        audience: true,
        createdAt: true,
        expiresAt: true,
        captionCiphertext: true,
        assets: true,
        author: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
    if (!status) return res.status(404).json({ error: 'Not found' });
    if (status.expiresAt && status.expiresAt <= new Date()) {
      return res.status(404).json({ error: 'Not found' });
    }

    const me = req.user;
    const isOwner = status.authorId === me.id;
    const isAdmin = me.role === 'ADMIN';

    const keyRow = await prisma.statusKey.findUnique({
      where: { statusId_userId: { statusId, userId: me.id } },
      select: { encryptedKey: true },
    });
    const hasKey = !!keyRow;

    let allowed = false;
    if (isOwner || isAdmin) allowed = true;
    else if (status.audience === 'EVERYONE') allowed = true; // <-- PUBLIC -> EVERYONE
    else if (status.audience === 'FOLLOWERS') {
      const rel = await prisma.follow.findFirst({
        where: { followerId: me.id, followeeId: status.authorId, accepted: true },
        select: { id: true },
      });
      allowed = !!rel;
    } else if (status.audience === 'MUTUALS' || status.audience === 'FRIENDS') {
      const [a, b] = await Promise.all([
        prisma.follow.findFirst({
          where: { followerId: me.id, followeeId: status.authorId, accepted: true },
          select: { id: true },
        }),
        prisma.follow.findFirst({
          where: { followerId: status.authorId, followeeId: me.id, accepted: true },
          select: { id: true },
        }),
      ]);
      allowed = !!a && !!b;
    } else if (status.audience === 'CONTACTS') {
      const contact = await prisma.contact.findFirst({
        where: { ownerId: status.authorId, contactUserId: me.id },
        select: { id: true },
      });
      allowed = !!contact;
    } else if (status.audience === 'CUSTOM') {
      allowed = hasKey;
    }

    if (allowed && !isOwner && !isAdmin && status.audience !== 'EVERYONE') {
      if (!hasKey) allowed = false;
    }
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    return res.json({
      id: status.id,
      author: status.author,
      assets: status.assets,
      captionCiphertext: status.captionCiphertext,
      encryptedKeyForMe: keyRow?.encryptedKey ?? null,
      expiresAt: status.expiresAt,
      createdAt: status.createdAt,
      reactionSummary: {},
    });
  })
);

/**
 * PATCH /status/:id/view
 */
router.patch(
  '/:id/view',
  requireAuth,
  asyncHandler(async (req, res) => {
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
      },
    });
    if (!status) return res.status(404).json({ error: 'Status not found' });
    if (status.expiresAt && status.expiresAt <= new Date()) {
      return res.status(404).json({ error: 'Status not found' });
    }

    const me = req.user;
    const isOwner = status.authorId === me.id;
    const isAdmin = me.role === 'ADMIN';

    let allowed = false;
    if (isOwner || isAdmin) allowed = true;
    else if (status.audience === 'EVERYONE') allowed = true; // <-- PUBLIC -> EVERYONE
    else {
      const hasKey = await prisma.statusKey.findUnique({
        where: { statusId_userId: { statusId, userId: me.id } },
        select: { userId: true },
      });
      allowed = !!hasKey;
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
  })
);

/**
 * POST /status/:id/reactions   (toggle)
 */
router.post(
  '/:id/reactions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const statusId = Number(req.params.id);
    const userId = Number(req.user.id);
    const emoji = String(req.body?.emoji || '').slice(0, 16);

    if (!Number.isInteger(statusId) || statusId <= 0) {
      return res.status(400).json({ error: 'Invalid status id' });
    }
    if (!emoji) return res.status(400).json({ error: 'Missing emoji' });

    const status = await prisma.status.findUnique({
      where: { id: statusId },
      select: { id: true, authorId: true, audience: true, expiresAt: true },
    });
    if (!status) return res.status(404).json({ error: 'Status not found' });
    if (status.expiresAt && status.expiresAt <= new Date()) {
      return res.status(404).json({ error: 'Status not found' });
    }

    let allowed = false;
    const me = req.user;
    const isOwner = status.authorId === me.id;
    const isAdmin = me.role === 'ADMIN';
    if (isOwner || isAdmin) allowed = true;
    else if (status.audience === 'EVERYONE') allowed = true; // <-- PUBLIC -> EVERYONE
    else {
      const hasKey = await prisma.statusKey.findUnique({
        where: { statusId_userId: { statusId, userId: me.id } },
        select: { userId: true },
      });
      allowed = !!hasKey;
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
      if (e?.code === 'P2003') return res.status(404).json({ error: 'Status not found' });
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
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const s = await prisma.status.findUnique({ where: { id }, select: { authorId: true } });
    if (!s) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'ADMIN' && s.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

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

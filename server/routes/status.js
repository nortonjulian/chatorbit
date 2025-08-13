// server/routes/status.js
import express from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../utils/prismaClient.js';
import { createStatusService } from '../services/statusService.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// POST /status  (create)
router.post('/', verifyToken, upload.array('files', 5), async (req, res) => {
  try {
    const authorId = req.user.id;
    const { caption, audience = 'MUTUALS', customAudienceIds, expireSeconds, attachmentsInline } = req.body;

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

    let inline = [];
    try {
      inline = JSON.parse(attachmentsInline || '[]');
    } catch {}
    inline = (inline || []).map((a) => ({
      kind: a.kind,
      url: a.url,
      mimeType: a.mimeType || '',
      width: a.width ?? null,
      height: a.height ?? null,
      durationSec: a.durationSec ?? null,
      caption: a.caption ?? null,
    }));

    const saved = await createStatusService({
      authorId,
      caption,
      files: [...uploaded, ...inline],
      audience,
      customAudienceIds: (() => {
        try {
          return JSON.parse(customAudienceIds || '[]');
        } catch {
          return [];
        }
      })(),
      expireSeconds: Number(expireSeconds) || 24 * 3600,
    });

    // Author’s devices room; join logic below in socket handler
    req.app.get('io')?.to(`user:${authorId}`).emit('status_posted', {
      id: saved.id,
      authorId,
    });

    res.status(201).json(saved);
  } catch (e) {
    console.error('create status failed', e);
    res.status(500).json({ error: 'Failed to post status' });
  }
});

// GET /status/feed — items current user can decrypt (uses StatusKey)
router.get('/feed', verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const statuses = await prisma.status.findMany({
      where: {
        expiresAt: { gt: new Date() },
        keys: { some: { userId } },
      },
      orderBy: [{ authorId: 'asc' }, { createdAt: 'desc' }],
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        assets: true,
        keys: { where: { userId }, select: { encryptedKey: true } },
        views: { where: { viewerId: userId }, select: { id: true } },
        reactions: true,
      },
    });

    const shaped = statuses.map((s) => {
      const reactionSummary = {};
      for (const r of s.reactions) reactionSummary[r.emoji] = (reactionSummary[r.emoji] || 0) + 1;
      return {
        id: s.id,
        author: s.author,
        assets: s.assets,
        captionCiphertext: s.captionCiphertext,
        encryptedKeyForMe: s.keys?.[0]?.encryptedKey ?? null,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
        viewerSeen: s.views.length > 0,
        reactionSummary,
      };
    });

    res.json(shaped);
  } catch (e) {
    console.error('feed failed', e);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// PATCH /status/:id/view
router.patch('/:id/view', verifyToken, async (req, res) => {
  const statusId = Number(req.params.id);
  const viewerId = req.user.id;
  try {
    await prisma.statusView.upsert({
      where: { statusId_viewerId: { statusId, viewerId } },
      update: {},
      create: { statusId, viewerId },
    });
    const author = await prisma.status.findUnique({ where: { id: statusId }, select: { authorId: true } });
    req.app.get('io')?.to(`user:${author.authorId}`).emit('status_viewed', { statusId, viewerId });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to mark viewed' });
  }
});

// POST /status/:id/reactions (toggle)
router.post('/:id/reactions', verifyToken, async (req, res) => {
  const statusId = Number(req.params.id);
  const userId = req.user.id;
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'emoji required' });

  try {
    const existing = await prisma.statusReaction.findUnique({
      where: { statusId_userId_emoji: { statusId, userId, emoji } },
    });
    if (existing) {
      await prisma.statusReaction.delete({ where: { statusId_userId_emoji: { statusId, userId, emoji } } });
      return res.json({ ok: true, op: 'removed', emoji });
    }
    await prisma.statusReaction.create({ data: { statusId, userId, emoji } });
    res.json({ ok: true, op: 'added', emoji });
  } catch (e) {
    res.status(500).json({ error: 'Failed to react' });
  }
});

// DELETE /status/:id
router.delete('/:id', verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.status.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;

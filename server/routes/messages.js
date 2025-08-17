import express from 'express';
import Boom from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';

import prisma from '../utils/prismaClient.js';
import { verifyToken } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createMessageService } from '../services/messageService.js';

// 🔐 secure upload utilities
import { makeUploader } from '../utils/upload.js';
import { scanFile } from '../utils/antivirus.js';
import { ensureThumb } from '../utils/thumbnailer.js';
import { signDownloadToken } from '../utils/downloadTokens.js';

const router = express.Router();

// Replace old multer with hardened uploader
const uploadMedia = makeUploader({ maxFiles: 10, maxBytes: 15 * 1024 * 1024, kind: 'media' });

// Per-endpoint rate limit for POST creates
const postMessageLimiter = rateLimit({
  windowMs: 10 * 1000, // 10s
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST',
});

/**
 * CREATE message (HTTP)
 * - Supports multiple file uploads via `files[]`
 * - Accepts optional `attachmentsMeta` JSON to pair per-file metadata by index
 * - Accepts optional `attachmentsInline` JSON for remote stickers/GIFs (no upload)
 * - Emits the saved message to the room via Socket.IO
 *
 * Body:
 *  - content?: string
 *  - chatRoomId: number|string
 *  - expireSeconds?: number
 *  - attachmentsMeta?: string (JSON: [{ idx, width?, height?, durationSec?, caption? }])
 *  - attachmentsInline?: string (JSON: [{ kind:'STICKER'|'GIF'|'IMAGE'|'VIDEO'|'AUDIO'|'FILE', url, mimeType?, width?, height?, durationSec?, caption? }])
 *
 * Files:
 *  - files[]: up to 10 files (image/video/audio/file)
 */
router.post(
  '/',
  postMessageLimiter,
  verifyToken,
  uploadMedia.array('files', 10),
  asyncHandler(async (req, res) => {
    const senderId = req.user?.id;
    if (!senderId) throw Boom.unauthorized();

    const { content, chatRoomId, expireSeconds, attachmentsMeta, attachmentsInline } =
      req.body || {};
    if (!chatRoomId) throw Boom.badRequest('chatRoomId is required');

    // Clamp optional per-message TTL (5s .. 7d)
    let secs = Number(expireSeconds);
    secs = Number.isFinite(secs) ? Math.max(5, Math.min(7 * 24 * 60 * 60, secs)) : undefined;

    // Parse meta
    let meta = [];
    try {
      meta = JSON.parse(attachmentsMeta || '[]');
      if (!Array.isArray(meta)) meta = [];
    } catch {
      meta = [];
    }

    const files = Array.isArray(req.files) ? req.files : [];

    // AV scan + derive attachments with PRIVATE paths (no /uploads in DB)
    const uploaded = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const m = meta.find((x) => Number(x.idx) === i) || {};
      const mime = f.mimetype || '';

      // Antivirus scan — delete & skip if bad
      const av = await scanFile(f.path);
      if (!av.ok) {
        await fs.promises.unlink(f.path).catch(() => {});
        continue;
      }

      const relName = path.basename(f.path); // e.g. "1712345678_abcd_file.jpg"
      const relPath = path.join('media', relName); // private ref

      // Generate thumbnail for images
      const isImage = mime.startsWith('image/');
      let thumbRel = null;
      if (isImage) {
        try {
          const t = await ensureThumb(f.path, relName); // returns { abs, rel }
          thumbRel = t.rel; // e.g. 'thumbs/1712..._file.thumb.jpg'
        } catch {
          // thumbnail generation best-effort
        }
      }

      uploaded.push({
        kind: isImage
          ? 'IMAGE'
          : mime.startsWith('video/')
            ? 'VIDEO'
            : mime.startsWith('audio/')
              ? 'AUDIO'
              : 'FILE',
        url: relPath, // store PRIVATE path in DB
        mimeType: mime,
        width: m.width ?? null,
        height: m.height ?? null,
        durationSec: m.durationSec ?? null,
        caption: m.caption ?? null,
        _thumb: thumbRel, // temp helper for shaping response
      });
    }

    // Inline attachments (stickers/GIFs by URL, no upload)
    let inline = [];
    try {
      inline = JSON.parse(attachmentsInline || '[]');
      if (!Array.isArray(inline)) inline = [];
    } catch {
      inline = [];
    }
    inline = inline
      .filter((a) => a && a.url && a.kind)
      .map((a) => ({
        kind: a.kind,
        url: a.url,
        mimeType: a.mimeType || (a.kind === 'STICKER' ? 'image/webp' : ''),
        width: a.width ?? null,
        height: a.height ?? null,
        durationSec: a.durationSec ?? null,
        caption: a.caption ?? null,
      }));

    const attachments = [...uploaded, ...inline];

    // Legacy single media fields (store PRIVATE refs; we’ll sign in shaped response)
    const firstImage = files.find((f) => f.mimetype?.startsWith('image/'));
    const firstAudio = files.find((f) => f.mimetype?.startsWith('audio/'));
    const firstAudioMeta = meta.find((m) => m.kind === 'AUDIO');

    const saved = await createMessageService({
      senderId,
      chatRoomId,
      content,
      expireSeconds: secs,
      imageUrl: firstImage ? path.join('media', path.basename(firstImage.path)) : null,
      audioUrl: firstAudio ? path.join('media', path.basename(firstAudio.path)) : null,
      audioDurationSec: firstAudioMeta?.durationSec ?? null,
      attachments,
    });

    // Shape response: replace PRIVATE refs with short-lived signed URLs (5 min)
    const toSigned = (rel, ownerId) =>
      `/files?token=${encodeURIComponent(signDownloadToken({ path: rel, ownerId, ttlSec: 300 }))}`;

    const shaped = {
      ...saved,
      imageUrl: saved.imageUrl ? toSigned(saved.imageUrl, senderId) : null,
      audioUrl: saved.audioUrl ? toSigned(saved.audioUrl, senderId) : null,
      attachments: saved.attachments.map((a, idx) => {
        const src = attachments[idx]; // same order as createMany
        const out = { ...a };
        out.url = a.url && !/^https?:\/\//i.test(a.url) ? toSigned(a.url, senderId) : a.url;
        if (src?._thumb) out.thumbUrl = toSigned(src._thumb, senderId);
        return out;
      }),
    };

    // Emit shaped message (no raw/private paths leave the server)
    req.app.get('io')?.to(String(chatRoomId)).emit('receive_message', shaped);
    return res.status(201).json(shaped);
  })
);

/**
 * LIST messages in a room
 * - Includes readBy for receipts
 * - Includes per-viewer encryptedKey via normalized MessageKey table
 * - Includes attachments array
 * - Includes reactions summary + viewer's own reactions
 */
router.get('/:chatRoomId', verifyToken, async (req, res) => {
  const chatRoomId = Number(req.params.chatRoomId);
  const requesterId = req.user.id;
  const isAdmin = req.user.role === 'ADMIN';

  try {
    if (!Number.isFinite(chatRoomId)) {
      return res.status(400).json({ error: 'Invalid chatRoomId' });
    }

    // Must be a participant unless admin
    if (!isAdmin) {
      const membership = await prisma.participant.findFirst({
        where: { chatRoomId, userId: requesterId },
      });
      if (!membership) return res.status(403).json({ error: 'Forbidden' });
    }

    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Math.min(Math.max(1, limitRaw), 100);
    const cursorId = req.query.cursor ? Number(req.query.cursor) : null;

    // Page by id (monotonic). Order newest → oldest
    const where = {
      chatRoomId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };

    const baseSelect = {
      id: true,
      contentCiphertext: true,
      translations: true,
      translatedContent: true,
      translatedTo: true,
      imageUrl: true,
      audioUrl: true,
      audioDurationSec: true,
      isExplicit: true,
      createdAt: true,
      expiresAt: true,
      rawContent: true,
      deletedBySender: true,
      sender: { select: { id: true, username: true } },
      readBy: { select: { id: true, username: true, avatarUrl: true } },
      attachments: {
        select: {
          id: true,
          kind: true,
          url: true,
          mimeType: true,
          width: true,
          height: true,
          durationSec: true,
          caption: true,
          createdAt: true,
        },
      },
      keys: {
        where: { userId: requesterId },
        select: { encryptedKey: true },
        take: 1,
      },
      chatRoomId: true,
    };

    const items = await prisma.message.findMany({
      where: cursorId ? { ...where, id: { lt: cursorId } } : where,
      orderBy: { id: 'desc' },
      take: limit,
      select: baseSelect,
    });

    // Aggregate reactions
    const messageIds = items.map((m) => m.id);

    let reactionSummaryByMessage = {};
    let myReactionsByMessage = {};

    if (messageIds.length) {
      const grouped = await prisma.messageReaction.groupBy({
        by: ['messageId', 'emoji'],
        where: { messageId: { in: messageIds } },
        _count: { emoji: true },
      });
      reactionSummaryByMessage = grouped.reduce((acc, r) => {
        (acc[r.messageId] ||= {})[r.emoji] = r._count.emoji;
        return acc;
      }, {});

      const mine = await prisma.messageReaction.findMany({
        where: { messageId: { in: messageIds }, userId: requesterId },
        select: { messageId: true, emoji: true },
      });
      myReactionsByMessage = mine.reduce((acc, r) => {
        (acc[r.messageId] ||= new Set()).add(r.emoji);
        return acc;
      }, {});
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { preferredLanguage: true },
    });
    const myLang = requester?.preferredLanguage || 'en';

    const shaped = items
      .filter((m) => !(m.deletedBySender && m.sender.id === requesterId))
      .map((m) => {
        const isSender = m.sender.id === requesterId;

        const fromMap =
          m.translations && typeof m.translations === 'object'
            ? (m.translations[myLang] ?? null)
            : null;
        const legacy = m.translatedTo && m.translatedTo === myLang ? m.translatedContent : null;
        const translatedForMe = fromMap || legacy || null;

        const encryptedKeyForMe = m.keys?.[0]?.encryptedKey || null;

        const reactionSummary = reactionSummaryByMessage[m.id] || {};
        const myReactions = Array.from(myReactionsByMessage[m.id] || []);

        const { translations, translatedContent, translatedTo, keys, ...rest } = m;

        const base = {
          ...rest,
          encryptedKeyForMe,
          translatedForMe,
          reactionSummary,
          myReactions,
        };

        if (isSender || isAdmin) return base;
        const { rawContent, ...restNoRaw } = base;
        return restNoRaw;
      });

    const nextCursor = shaped.length === limit ? shaped[shaped.length - 1].id : null;

    return res.json({ items: shaped, nextCursor, count: shaped.length });
  } catch (error) {
    console.error('Error fetching messages', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * PATCH /messages/:id/read
 * Single mark-as-read with membership check + socket emit
 */
router.patch(
  '/:id/read',
  verifyToken,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const userId = req.user?.id;

    if (!Number.isFinite(id)) throw Boom.badRequest('Invalid id');

    const m = await prisma.message.findUnique({
      where: { id },
      select: { id: true, chatRoomId: true },
    });
    if (!m) throw Boom.notFound('Not found');

    const isMember = await prisma.participant.findFirst({
      where: { chatRoomId: m.chatRoomId, userId },
      select: { id: true },
    });
    if (!isMember) throw Boom.forbidden('Forbidden');

    await prisma.message.update({
      where: { id },
      data: { readBy: { connect: { id: userId } } },
      select: { id: true },
    });

    const io = req.app.get('io');
    io?.to(String(m.chatRoomId)).emit('message_read', {
      messageId: id,
      reader: { id: userId, username: req.user.username },
    });

    return res.json({ ok: true });
  })
);

/**
 * POST /messages/read-bulk
 */
router.post(
  '/read-bulk',
  verifyToken,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const ids = (req.body?.ids || []).map(Number).filter(Number.isFinite);

    if (!ids.length) return res.json({ ok: true });

    const msgs = await prisma.message.findMany({
      where: { id: { in: ids } },
      select: { id: true, chatRoomId: true },
    });

    const rooms = [...new Set(msgs.map((m) => m.chatRoomId))];
    const allowed = await prisma.participant.findMany({
      where: { userId, chatRoomId: { in: rooms } },
      select: { chatRoomId: true },
    });
    const allowedSet = new Set(allowed.map((a) => a.chatRoomId));
    const allowedIds = msgs.filter((m) => allowedSet.has(m.chatRoomId)).map((m) => m.id);

    if (!allowedIds.length) return res.json({ ok: true });

    await prisma.$transaction(
      allowedIds.map((id) =>
        prisma.message.update({
          where: { id },
          data: { readBy: { connect: { id: userId } } },
          select: { id: true },
        })
      )
    );

    const io = req.app.get('io');
    for (const m of msgs.filter((m) => allowedIds.includes(m.id))) {
      io?.to(String(m.chatRoomId)).emit('message_read', {
        messageId: m.id,
        reader: { id: userId, username: req.user.username },
      });
    }

    return res.json({ ok: true, count: allowedIds.length });
  })
);

/**
 * REACTIONS
 */
router.post(
  '/:id/reactions',
  verifyToken,
  asyncHandler(async (req, res) => {
    const messageId = Number(req.params.id);
    const userId = req.user?.id;
    const { emoji } = req.body || {};

    if (!emoji || typeof emoji !== 'string') throw Boom.badRequest('emoji is required');
    if (!Number.isFinite(messageId)) throw Boom.badRequest('Invalid id');

    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { chatRoomId: true },
    });
    if (!msg) throw Boom.notFound('Not found');

    const member = await prisma.participant.findFirst({
      where: { chatRoomId: msg.chatRoomId, userId },
    });
    if (!member) throw Boom.forbidden('Forbidden');

    const existing = await prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    if (existing) {
      await prisma.messageReaction.delete({
        where: { messageId_userId_emoji: { messageId, userId, emoji } },
      });
      const count = await prisma.messageReaction.count({ where: { messageId, emoji } });
      req.app
        .get('io')
        ?.to(String(msg.chatRoomId))
        .emit('reaction_updated', {
          messageId,
          emoji,
          op: 'removed',
          user: { id: userId, username: req.user.username },
          count,
        });
      return res.json({ ok: true, op: 'removed', emoji, count });
    }

    await prisma.messageReaction.create({ data: { messageId, userId, emoji } });
    const count = await prisma.messageReaction.count({ where: { messageId, emoji } });
    req.app
      .get('io')
      ?.to(String(msg.chatRoomId))
      .emit('reaction_updated', {
        messageId,
        emoji,
        op: 'added',
        user: { id: userId, username: req.user.username },
        count,
      });
    return res.json({ ok: true, op: 'added', emoji, count });
  })
);

router.delete(
  '/:id/reactions/:emoji',
  verifyToken,
  asyncHandler(async (req, res) => {
    const messageId = Number(req.params.id);
    if (!Number.isFinite(messageId)) throw Boom.badRequest('Invalid id');

    const userId = req.user?.id;
    const emoji = decodeURIComponent(req.params.emoji || '');

    await prisma.messageReaction
      .delete({ where: { messageId_userId_emoji: { messageId, userId, emoji } } })
      .catch(() => {});

    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { chatRoomId: true },
    });

    if (msg) {
      const count = await prisma.messageReaction.count({ where: { messageId, emoji } });
      req.app
        .get('io')
        ?.to(String(msg.chatRoomId))
        .emit('reaction_updated', {
          messageId,
          emoji,
          op: 'removed',
          user: { id: userId, username: req.user.username },
          count,
        });
    }

    return res.json({ ok: true, op: 'removed', emoji });
  })
);

/**
 * EDIT message
 */
router.patch(
  '/:id/edit',
  verifyToken,
  asyncHandler(async (req, res) => {
    const messageId = Number(req.params.id);
    const requesterId = req.user?.id;
    const { newContent } = req.body || {};

    if (!Number.isFinite(messageId)) throw Boom.badRequest('Invalid id');
    if (!newContent) throw Boom.badRequest('newContent is required');

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: true,
        chatRoom: { include: { participants: { include: { user: true } } } },
        readBy: true,
      },
    });

    if (!message) throw Boom.notFound('Message not found');
    if (message.sender.id !== requesterId || (message.readBy?.length ?? 0) > 0) {
      throw Boom.forbidden('Unauthorized or already read');
    }

    const { encryptMessageForParticipants } = await import('../utils/encryption.js');
    const { translateMessageIfNeeded } = await import('../utils/translateMessageIfNeeded.js');

    const { ciphertext, encryptedKeys } = await encryptMessageForParticipants(
      newContent,
      message.sender,
      message.chatRoom.participants.map((p) => p.user)
    );

    const { translatedText, targetLang } = await translateMessageIfNeeded(
      newContent,
      message.sender,
      message.chatRoom.participants
    );

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        rawContent: newContent,
        contentCiphertext: ciphertext,
        encryptedKeys,
        translatedContent: translatedText,
        translatedTo: targetLang,
      },
      include: {
        sender: { select: { id: true, username: true } },
      },
    });

    return res.json(updated);
  })
);

/**
 * DELETE message (soft-delete by sender; admins allowed)
 */
router.delete(
  '/:id',
  verifyToken,
  audit('messages.delete', {
    resource: 'message',
    resourceId: (req) => req.params.id,
  }),
  asyncHandler(async (req, res) => {
    const messageId = Number(req.params.id);
    const requesterId = req.user?.id;
    const isAdmin = req.user?.role === 'ADMIN';

    if (!Number.isFinite(messageId)) throw Boom.badRequest('Invalid id');

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true },
    });

    if (!message) throw Boom.notFound('Message not found');
    if (!isAdmin && message.senderId !== requesterId) {
      throw Boom.forbidden('Unauthorized to delete this message');
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { deletedBySender: true },
    });

    return res.json({ success: true });
  })
);

/**
 * Report a message (user forwards decrypted content to admin)
 */
router.post(
  '/report',
  verifyToken,
  asyncHandler(async (req, res) => {
    const { messageId, decryptedContent } = req.body || {};
    const reporterId = req.user?.id;

    if (!messageId || !decryptedContent) {
      throw Boom.badRequest('messageId and decryptedContent are required');
    }

    await prisma.report.create({
      data: {
        messageId: Number(messageId),
        reporterId: Number(reporterId),
        decryptedContent,
      },
    });

    return res.status(201).json({ success: true });
  })
);

/**
 * FORWARD a message to another room (reuses attachments)
 */
router.post(
  '/:id/forward',
  verifyToken,
  asyncHandler(async (req, res) => {
    const srcId = Number(req.params.id);
    const { toRoomId, note } = req.body || {};
    const userId = req.user?.id;

    if (!Number.isFinite(srcId)) throw Boom.badRequest('Invalid id');
    if (!toRoomId) throw Boom.badRequest('toRoomId is required');

    const src = await prisma.message.findUnique({
      where: { id: srcId },
      include: { chatRoom: { select: { id: true } }, attachments: true },
    });
    if (!src) throw Boom.notFound('Not found');

    // Must be a participant in BOTH rooms
    const [inSrc, inDst] = await Promise.all([
      prisma.participant.findFirst({ where: { chatRoomId: src.chatRoomId, userId } }),
      prisma.participant.findFirst({ where: { chatRoomId: Number(toRoomId), userId } }),
    ]);
    if (!inSrc || !inDst) throw Boom.forbidden('Forbidden');

    const saved = await createMessageService({
      senderId: userId,
      chatRoomId: Number(toRoomId),
      content: note || '(forwarded)',
      attachments: src.attachments.map((a) => ({
        kind: a.kind,
        url: a.url, // still private; client will receive signed links on creation path
        mimeType: a.mimeType,
        width: a.width,
        height: a.height,
        durationSec: a.durationSec,
        caption: a.caption,
      })),
    });

    req.app.get('io')?.to(String(toRoomId)).emit('receive_message', saved);
    return res.json(saved);
  })
);

export default router;

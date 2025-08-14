import express from 'express';
import Boom from '@hapi/boom';
import multer from 'multer';

import prisma from '../utils/prismaClient.js';
import { verifyToken } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createMessageService } from '../services/messageService.js';

const router = express.Router();

// Store uploads on disk (adjust to memory/S3/etc. as needed)
const upload = multer({ dest: 'uploads/' });

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
  verifyToken,
  upload.array('files', 10),
  asyncHandler(async (req, res) => {
    const senderId = req.user?.id;
    if (!senderId) throw Boom.unauthorized();

    const { content, chatRoomId, expireSeconds, attachmentsMeta, attachmentsInline } = req.body || {};
    if (!chatRoomId) throw Boom.badRequest('chatRoomId is required');

    // Clamp optional per-message TTL (5s .. 7d). Omit if invalid.
    let secs = Number(expireSeconds);
    secs = Number.isFinite(secs) ? Math.max(5, Math.min(7 * 24 * 60 * 60, secs)) : undefined;

    // Pair files with client-provided meta (index-based)
    let meta = [];
    try {
      meta = JSON.parse(attachmentsMeta || '[]');
      if (!Array.isArray(meta)) meta = [];
    } catch {
      meta = [];
    }

    const files = Array.isArray(req.files) ? req.files : [];

    const uploaded = files.map((f, i) => {
      const m = meta.find((x) => Number(x.idx) === i) || {};
      const mime = f.mimetype || '';
      const kind =
        mime.startsWith('image/') ? 'IMAGE' :
        mime.startsWith('video/') ? 'VIDEO' :
        mime.startsWith('audio/') ? 'AUDIO' : 'FILE';

      return {
        kind,
        url: `/uploads/${f.filename}`,
        mimeType: mime,
        width: m.width ?? null,
        height: m.height ?? null,
        durationSec: m.durationSec ?? null,
        caption: m.caption ?? null,
      };
    });

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
        kind: a.kind, // 'STICKER' | 'GIF' | etc.
        url: a.url,
        mimeType: a.mimeType || (a.kind === 'STICKER' ? 'image/webp' : ''),
        width: a.width ?? null,
        height: a.height ?? null,
        durationSec: a.durationSec ?? null,
        caption: a.caption ?? null,
      }));

    const attachments = [...uploaded, ...inline];

    // Backward-compat single media (optional; can be removed once fully on attachments)
    const firstImage = files.find((f) => f.mimetype?.startsWith('image/'));
    const firstAudio = files.find((f) => f.mimetype?.startsWith('audio/'));
    const firstAudioMeta = meta.find((m) => m.kind === 'AUDIO');

    const saved = await createMessageService({
      senderId,
      chatRoomId,
      content,
      expireSeconds: secs,
      imageUrl: firstImage ? `/uploads/${firstImage.filename}` : null, // legacy surface
      audioUrl: firstAudio ? `/uploads/${firstAudio.filename}` : null, // legacy surface
      audioDurationSec: firstAudioMeta?.durationSec ?? null,
      attachments, // unified attachments array
    });

    req.app.get('io')?.to(String(chatRoomId)).emit('receive_message', saved);
    return res.status(201).json(saved);
  })
);

/**
 * LIST messages in a room
 * - Includes readBy for receipts
 * - Includes per-viewer encryptedKey via normalized MessageKey table
 * - Includes attachments array
 * - Includes reactions summary + viewer's own reactions
 */
router.get(
  '/:chatRoomId',
  verifyToken,
  asyncHandler(async (req, res) => {
    const chatRoomId = Number(req.params.chatRoomId);
    const requesterId = req.user?.id;
    const isAdmin = req.user?.role === 'ADMIN';

    if (!Number.isFinite(chatRoomId)) throw Boom.badRequest('Invalid chatRoomId');

    // Must be a participant unless admin
    if (!isAdmin) {
      const membership = await prisma.participant.findFirst({
        where: { chatRoomId, userId: requesterId },
      });
      if (!membership) throw Boom.forbidden('Forbidden');
    }

    // Requester’s UI language
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { preferredLanguage: true },
    });
    const myLang = requester?.preferredLanguage || 'en';

    // Fetch messages + ONLY my key from normalized MessageKey table
    const messages = await prisma.message.findMany({
      where: {
        chatRoomId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        contentCiphertext: true,
        translations: true,          // JSON map of lang -> text (plaintext)
        translatedContent: true,     // legacy single translation
        translatedTo: true,          // legacy single translation
        imageUrl: true,              // legacy single media
        audioUrl: true,              // legacy single media
        audioDurationSec: true,      // legacy single media
        isExplicit: true,
        createdAt: true,
        expiresAt: true,
        rawContent: true,            // sender/admin only in response shaping
        deletedBySender: true,
        sender: { select: { id: true, username: true } },
        readBy: {                    // read receipts UI
          select: { id: true, username: true, avatarUrl: true },
        },
        attachments: {               // gallery/forwarding
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
        reactions: {                 // for summary + myReactions
          select: { emoji: true, userId: true },
        },
        keys: {
          where: { userId: requesterId },
          select: { encryptedKey: true },
          take: 1,
        },
        chatRoomId: true,
      },
    });

    // Filter and shape for client
    const safe = messages
      .filter((m) => !(m.deletedBySender && m.sender.id === requesterId))
      .map((m) => {
        const isSender = m.sender.id === requesterId;

        // Best translation for this viewer
        const fromMap =
          m.translations && typeof m.translations === 'object'
            ? m.translations[myLang] ?? null
            : null;
        const legacy =
          m.translatedTo && m.translatedTo === myLang
            ? m.translatedContent
            : null;
        const translatedForMe = fromMap || legacy || null;

        const encryptedKeyForMe = m.keys?.[0]?.encryptedKey || null;

        // reactions summary + mine
        const reactionSummary = {};
        const myReactions = [];
        for (const r of (m.reactions || [])) {
          reactionSummary[r.emoji] = (reactionSummary[r.emoji] || 0) + 1;
          if (r.userId === requesterId) myReactions.push(r.emoji);
        }

        const {
          translations,        // drop full map
          translatedContent,   // drop legacy
          translatedTo,        // drop legacy
          keys,                // drop raw keys array
          reactions,           // drop raw rows
          ...rest
        } = m;

        const base = {
          ...rest,
          encryptedKeyForMe,
          translatedForMe,
          reactionSummary,
          myReactions,
        };

        if (isSender || isAdmin) {
          // Sender/admin can see rawContent
          return base;
        }

        // Others do NOT get rawContent
        const { rawContent, ...restNoRaw } = base;
        return restNoRaw;
      });

    return res.json(safe);
  })
);

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

    // Look up message to get room for membership check
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

    // Connect user to readBy (no-op if already connected)
    await prisma.message.update({
      where: { id },
      data: { readBy: { connect: { id: userId } } },
      select: { id: true }, // minimal select
    });

    // Notify room in real-time
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
 * Batched mark-as-read with membership check + per-message socket emit
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

    // Only allow marking read in rooms the user belongs to
    const rooms = [...new Set(msgs.map((m) => m.chatRoomId))];
    const allowed = await prisma.participant.findMany({
      where: { userId, chatRoomId: { in: rooms } },
      select: { chatRoomId: true },
    });
    const allowedSet = new Set(allowed.map((a) => a.chatRoomId));
    const allowedIds = msgs
      .filter((m) => allowedSet.has(m.chatRoomId))
      .map((m) => m.id);

    if (!allowedIds.length) return res.json({ ok: true });

    // One-by-one so we can emit per-message (updateMany can't connect M2M)
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
 * Toggle (POST) and remove (DELETE)
 */
router.post(
  '/:id/reactions',
  verifyToken,
  asyncHandler(async (req, res) => {
    const messageId = Number(req.params.id);
    const userId = req.user?.id;
    const { emoji } = req.body || {};

    if (!emoji || typeof emoji !== 'string') {
      throw Boom.badRequest('emoji is required');
    }
    if (!Number.isFinite(messageId)) throw Boom.badRequest('Invalid id');

    // ensure membership
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { chatRoomId: true },
    });
    if (!msg) throw Boom.notFound('Not found');

    const member = await prisma.participant.findFirst({
      where: { chatRoomId: msg.chatRoomId, userId },
    });
    if (!member) throw Boom.forbidden('Forbidden');

    // toggle
    const existing = await prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    if (existing) {
      await prisma.messageReaction.delete({
        where: { messageId_userId_emoji: { messageId, userId, emoji } },
      });
      const count = await prisma.messageReaction.count({ where: { messageId, emoji } });
      req.app.get('io')?.to(String(msg.chatRoomId)).emit('reaction_updated', {
        messageId,
        emoji,
        op: 'removed',
        user: { id: userId, username: req.user.username },
        count,
      });
      return res.json({ ok: true, op: 'removed', emoji, count });
    }

    await prisma.messageReaction.create({
      data: { messageId, userId, emoji },
    });

    const count = await prisma.messageReaction.count({ where: { messageId, emoji } });
    req.app.get('io')?.to(String(msg.chatRoomId)).emit('reaction_updated', {
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

    // Idempotent remove: do not throw if it doesn't exist
    await prisma.messageReaction.delete({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    }).catch(() => {});

    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { chatRoomId: true },
    });

    if (msg) {
      const count = await prisma.messageReaction.count({ where: { messageId, emoji } });
      req.app.get('io')?.to(String(msg.chatRoomId)).emit('reaction_updated', {
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
 * DELETE message
 * (soft-delete by sender; admins allowed)
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
 * FORWARD a message to another room (reuses attachments; add file-copying if desired)
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
        url: a.url, // reuse (or copy file to a new path if you prefer)
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

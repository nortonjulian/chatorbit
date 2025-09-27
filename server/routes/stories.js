import express from 'express';
import Boom from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';

import prisma from '../utils/prismaClient.js';
import { requireAuth } from '../middleware/auth.js';

// reuse your hardened media pipeline
import { uploadMedia } from '../middleware/uploads.js';
import { scanFile } from '../utils/antivirus.js';
import { ensureThumb } from '../utils/thumbnailer.js';
import { signDownloadToken } from '../utils/downloadTokens.js';

const router = express.Router();

const createLimiter = rateLimit({
  windowMs: 15 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// helper: sign private /media/* paths (same approach as messages.js)
function toSigned(rel, ownerId) {
  if (!rel) return null;
  const token = signDownloadToken({ path: rel, ownerId, ttlSec: 300 });
  return `/files?token=${encodeURIComponent(token)}`;
}

/**
 * POST /stories
 * Create a story with optional image/video and optional audio track.
 * Body (multipart/form-data):
 *   - files[]: media; we pick first image/video as visual, first audio as soundtrack
 *   - fields: { caption, expireSeconds?, attachmentsMeta? }
 * attachmentsMeta example:
 *   [
 *     { idx: 0, kind: "AUDIO", durationSec: 12.3, caption: "song" },
 *     { idx: 1, kind: "IMAGE", width: 1080, height: 1920 }
 *   ]
 */
router.post(
  '/',
  requireAuth,
  createLimiter,
  uploadMedia.array('files', 5),
  async (req, res, next) => {
    try {
      const userId = Number(req.user?.id);
      if (!userId) throw Boom.unauthorized();

      const { caption = '', expireSeconds, attachmentsMeta } = req.body || {};

      // Clamp TTL (default 24h)
      let ttl = Number(expireSeconds);
      if (!Number.isFinite(ttl)) ttl = 24 * 3600;
      ttl = Math.max(5, Math.min(7 * 24 * 3600, ttl));

      // Parse meta (optional)
      let meta = [];
      try {
        meta = JSON.parse(attachmentsMeta || '[]');
        if (!Array.isArray(meta)) meta = [];
      } catch {
        meta = [];
      }

      const files = Array.isArray(req.files) ? req.files : [];
      let visualRel = null;         // image OR video, choose first
      let visualKind = null;        // 'IMAGE' | 'VIDEO'
      let visualThumbRel = null;
      let audioRel = null;          // audio overlay
      let audioMime = '';
      let audioDurationSec = null;

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const m = meta.find((x) => Number(x.idx) === i) || {};
        const mime = f.mimetype || '';

        // AV scan (delete & skip if bad)
        const av = await scanFile(f.path);
        if (!av.ok) {
          try { await fs.promises.unlink(f.path); } catch {}
          continue;
        }

        const relName = path.basename(f.path);
        const relPath = path.join('media', relName);

        if (!visualRel && mime.startsWith('image/')) {
          visualRel = relPath;
          visualKind = 'IMAGE';
          try {
            const t = await ensureThumb(f.path, relName);
            visualThumbRel = t.rel;
          } catch {}
          continue;
        }

        if (!visualRel && mime.startsWith('video/')) {
          visualRel = relPath;
          visualKind = 'VIDEO';
          // (thumb optional for videos; omit for now)
          continue;
        }

        if (!audioRel && mime.startsWith('audio/')) {
          audioRel = relPath;
          audioMime = mime;
          audioDurationSec = m.durationSec ?? null;
          continue;
        }
      }

      if (!visualRel && !audioRel) {
        throw Boom.badRequest('Provide at least one media file (image/video or audio)');
      }

      const expiresAt = new Date(Date.now() + ttl * 1000);

      // Try schema with columns on Story (recommended)
      let saved;
      try {
        saved = await prisma.story.create({
          data: {
            userId,
            caption: String(caption || ''),
            imageUrl: visualKind === 'IMAGE' ? visualRel : null,
            videoUrl: visualKind === 'VIDEO' ? visualRel : null,
            audioUrl: audioRel || null,
            audioMimeType: audioMime || null,
            audioDurationSec: audioDurationSec ? Number(audioDurationSec) : null,
            // if you store thumbs:
            thumbUrl: visualThumbRel || null,
            expiresAt,
          },
          select: {
            id: true,
            userId: true,
            caption: true,
            imageUrl: true,
            videoUrl: true,
            audioUrl: true,
            audioMimeType: true,
            audioDurationSec: true,
            thumbUrl: true,
            createdAt: true,
            expiresAt: true,
          },
        });
      } catch (e1) {
        // Fallback: minimal create with fewer columns (schema tolerant)
        saved = await prisma.story.create({
          data: {
            userId,
            caption: String(caption || ''),
            // keep only fields likely to exist
            imageUrl: visualKind === 'IMAGE' ? visualRel : null,
            videoUrl: visualKind === 'VIDEO' ? visualRel : null,
            audioUrl: audioRel || null,
            expiresAt,
          },
          select: {
            id: true,
            userId: true,
            caption: true,
            imageUrl: true,
            videoUrl: true,
            audioUrl: true,
            createdAt: true,
            expiresAt: true,
          },
        });
      }

      // Shape response with signed URLs for private paths
      const shaped = {
        ...saved,
        imageUrl: saved.imageUrl ? toSigned(saved.imageUrl, userId) : null,
        videoUrl: saved.videoUrl ? toSigned(saved.videoUrl, userId) : null,
        audioUrl: saved.audioUrl ? toSigned(saved.audioUrl, userId) : null,
        thumbUrl: saved.thumbUrl ? toSigned(saved.thumbUrl, userId) : null,
      };

      return res.status(201).json(shaped);
    } catch (err) {
      return next(err.isBoom ? err : Boom.badImplementation(err.message));
    }
  }
);

export default router;

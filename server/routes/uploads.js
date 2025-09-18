import express from 'express';
import Boom from '@hapi/boom';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../utils/prismaClient.js';
import { singleUpload, buildSafeName, sha256 } from '../middleware/upload.js';
import storage from '../services/storage/index.js';
import { STORAGE_DRIVER } from '../utils/uploadConfig.js';
import fs from 'node:fs';
import { keyToAbsolute } from '../services/storage/localStorage.js';

const router = express.Router();

// POST /uploads  (multipart/form-data with "file")
router.post('/', requireAuth, singleUpload, async (req, res, next) => {
  try {
    const f = req.file;
    if (!f || !f.buffer) throw Boom.badRequest('file is required');

    const digest = sha256(f.buffer);
    const { ext, suggested } = buildSafeName(f.mimetype, f.originalname);

    // de-dup: do we have this hash already?
    let existing = await prisma.upload.findFirst({
      where: { sha256: digest, ownerId: req.user.id },
      select: { id: true },
    });
    if (existing) {
      return res.status(200).json({ id: existing.id, dedup: true });
    }

    // storage key: user/{id}/{sha256}.{ext}
    const key = `user/${req.user.id}/${digest}.${ext}`;

    // Store
    await storage.storeBuffer({ buf: f.buffer, key, contentType: f.mimetype });

    // DB row
    const rec = await prisma.upload.create({
      data: {
        ownerId: req.user.id,
        key,
        sha256: digest,
        originalName: suggested,
        mimeType: f.mimetype,
        size: f.size,
        driver: STORAGE_DRIVER,
      },
      select: { id: true, originalName: true, mimeType: true, size: true },
    });

    return res.status(201).json({ id: rec.id, name: rec.originalName, mimeType: rec.mimeType, size: rec.size });
  } catch (e) {
    next(e.isBoom ? e : Boom.badRequest(e.message || 'Upload failed'));
  }
});

// GET /uploads/:id  (download)
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw Boom.badRequest('invalid id');

    const up = await prisma.upload.findUnique({
      where: { id },
      select: { id: true, ownerId: true, key: true, mimeType: true, originalName: true, driver: true, size: true },
    });
    if (!up) throw Boom.notFound('not found');

    // basic ACL: only owner can download (extend to room-based ACL if needed)
    if (up.ownerId !== req.user.id) throw Boom.forbidden('no access');

    // headers
    res.setHeader('Content-Type', up.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', up.size);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // force download as attachment (prevents in-browser script execution)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(up.originalName || 'file')}"`);

    if (up.driver === 's3') {
      const s3 = await (await import('../services/storage/s3Storage.js')).readStream({ key: up.key });
      if (!s3.ok) throw Boom.badGateway('read failed');
      s3.body.pipe(res);
    } else {
      const abs = keyToAbsolute(up.key);
      const rs = fs.createReadStream(abs);
      rs.on('error', () => next(Boom.notFound('file missing')));
      rs.pipe(res);
    }
  } catch (e) {
    next(e.isBoom ? e : Boom.badRequest(e.message || 'Download failed'));
  }
});

export default router;

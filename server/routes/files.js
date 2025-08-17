import express from 'express';
import fs from 'fs';
import path from 'path';
import Boom from '@hapi/boom';
import mime from 'mime-types';
import { verifyToken } from '../middleware/auth.js';
import { verifyDownloadToken } from '../utils/downloadTokens.js';

const router = express.Router();

// GET /files?token=...
router.get('/', verifyToken, async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) throw Boom.badRequest('token required');

    const payload = verifyDownloadToken(token); // { p, o, u }
    // Optional: enforce ownership check (e.g., payload.o === req.user.id) or richer ACLs.
    // If files can be shared with others (e.g., room participants), you can skip strict owner match
    // and instead verify membership before streaming. Keep it simple for now:
    if (payload.o !== req.user.id && req.user.role !== 'ADMIN') {
      throw Boom.forbidden('forbidden');
    }

    // Resolve path safely inside your storage root
    const storageRoot = path.resolve(process.env.UPLOADS_DIR || 'uploads');
    const abs = path.resolve(storageRoot, '.' + path.sep + payload.p);
    if (!abs.startsWith(storageRoot)) throw Boom.forbidden('bad path');

    // Basic existence & type
    const stat = await fs.promises.stat(abs).catch(() => null);
    if (!stat || !stat.isFile()) throw Boom.notFound('not found');

    // Content type by extension (you could also sniff if you want)
    const contentType = mime.lookup(abs) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(stat.size));
    // Safe default: inline images/audio/video, attachment for everything else
    const isInline = /^image\/|^audio\/|^video\//.test(contentType);
    res.setHeader(
      'Content-Disposition',
      `${isInline ? 'inline' : 'attachment'}; filename="${path.basename(abs)}"`
    );
    // Short cache to allow browser back/forward but not long-term reuse
    res.setHeader('Cache-Control', 'private, max-age=120');

    fs.createReadStream(abs).pipe(res);
  } catch (e) {
    const status = e?.output?.statusCode || 400;
    res.status(status).json({ error: e.message || 'download failed' });
  }
});

export default router;

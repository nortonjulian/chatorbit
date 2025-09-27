import express from 'express';
import Boom from '@hapi/boom';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../utils/prismaClient.js';
import { translateBatch } from '../services/translation/index.js';

const router = express.Router();

const translateLimiter = rateLimit({
  windowMs: 15 * 1000,
  max: 60,                   // burst per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || req.ip),
});

router.post(
  '/batch',
  requireAuth,
  translateLimiter,
  async (req, res, next) => {
    try {
      const userId = Number(req.user?.id);
      const { items = [], target } = req.body || {};
      // items: [{ id, text }]
      if (!Array.isArray(items) || !items.length) throw Boom.badRequest('items required');

      // Default target: user's preferredLanguage
      let targetLanguage = (typeof target === 'string' && target) || 'en';
      if (!req.body?.target) {
        const me = await prisma.user.findUnique({
          where: { id: userId },
          select: { preferredLanguage: true },
        });
        if (me?.preferredLanguage) targetLanguage = me.preferredLanguage;
      }

      const texts = items.map(i => String(i.text || ''));
      const results = await translateBatch(texts, targetLanguage);

      const out = items.map((it, i) => ({
        id: it.id,
        translatedText: results[i]?.text || '',
        detectedSourceLanguage: results[i]?.detectedSourceLanguage || null,
        targetLanguage,
      }));

      return res.json({ translations: out });
    } catch (err) {
      next(err.isBoom ? err : Boom.badImplementation(err.message));
    }
  }
);

export default router;

import express from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { validateRegistrationInput } from '../utils/validateUser.js';

// 🔐 secure upload utilities
import { makeUploader } from '../utils/upload.js';
import { scanFile } from '../utils/antivirus.js';
import { signDownloadToken } from '../utils/downloadTokens.js';

import path from 'path';
import fs from 'fs';

const router = express.Router();
const prisma = new PrismaClient();

/* ---------------------- PUBLIC: create user ---------------------- */
router.post('/', async (req, res) => {
  const { username, email, password } = req.body;

  const validationError = validateRegistrationInput(username, email, password);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: 'USER',
      },
    });

    const { password: _omit, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.log('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/* ---------------------- USER SEARCH ---------------------- */
router.get('/search', requireAuth, async (req, res) => {
  try {
    const qRaw = String(req.query.query || '').trim();
    if (!qRaw) return res.json([]);

    const isAdmin = req.user?.role === 'ADMIN';
    const qDigits = qRaw.replace(/\D+/g, '');

    const OR = [
      { username: { contains: qRaw, mode: 'insensitive' } },
      { email: { contains: qRaw, mode: 'insensitive' } },
    ];

    if (qDigits.length >= 4) OR.push({ phoneNumber: { contains: qDigits } });
    if (/^\+?\d{4,}$/.test(qRaw)) OR.push({ phoneNumber: { contains: qRaw } });

    const users = await prisma.user.findMany({
      where: { OR, NOT: { id: req.user.id } },
      select: isAdmin
        ? {
            id: true,
            username: true,
            email: true,
            phoneNumber: true,
            preferredLanguage: true,
          }
        : {
            id: true,
            username: true,
            phoneNumber: true,
            preferredLanguage: true,
          },
      take: 10,
    });

    res.json(users);
  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/* ---------------------- UPDATE (self or admin) ---------------------- */
// Limited update by ID (self or admin)
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const {
    preferredLanguage,
    allowExplicitContent,
    showOriginalWithTranslation,
  } = req.body;

  const currentUser = req.user;
  if (Number(id) !== currentUser.id && currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: {
        preferredLanguage,
        allowExplicitContent: allowExplicitContent ?? true,
        showOriginalWithTranslation: showOriginalWithTranslation ?? true,
      },
    });
    res.json(updatedUser);
  } catch (error) {
    console.log('Error updating user', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/* ---------------------- AVATAR UPLOAD (hardened) ---------------------- */
const uploadAvatar = makeUploader({
  maxFiles: 1,
  maxBytes: 5 * 1024 * 1024,
  kind: 'avatar',
});

router.post(
  '/avatar',
  requireAuth,
  uploadAvatar.single('avatar'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      // Optional AV check
      const abs = req.file.path;
      const av = await scanFile(abs);
      if (!av.ok) {
        await fs.promises.unlink(abs).catch(() => {});
        return res.status(400).json({ error: 'File failed security scan' });
      }

      // Store only a private relative filename
      const rel = path.basename(req.file.path);

      await prisma.user.update({
        where: { id: req.user.id },
        data: { avatarUrl: rel },
        select: { id: true },
      });

      // Short-lived signed URL (prefix with avatars/)
      const token = signDownloadToken({
        path: path.join('avatars', rel),
        ownerId: req.user.id,
        ttlSec: 300,
      });

      res.json({ avatarUrl: `/files?token=${encodeURIComponent(token)}` });
    } catch (error) {
      console.log('Avatar upload failed', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

/* ---------------------- PUBLIC KEY UPLOAD ---------------------- */
router.post('/keys', requireAuth, async (req, res) => {
  const { publicKey } = req.body;
  if (!publicKey) return res.status(400).json({ error: 'Missing publicKey' });

  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { publicKey },
      select: { id: true, publicKey: true },
    });
    res.json(updated);
  } catch (e) {
    console.error('Key upload failed', e);
    res.status(500).json({ error: 'Failed to upload key' });
  }
});

/* ---------------------- EMOJI TAG ---------------------- */
router.patch('/emoji', requireAuth, async (req, res) => {
  const { emoji } = req.body;
  const userId = req.user.id;

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { emojiTag: emoji },
    });

    res.json({ emojiTag: updated.emojiTag });
  } catch (err) {
    console.error('Emoji update failed', err);
    res.status(500).json({ error: 'Failed to update emoji' });
  }
});

/* ---------------------- PROFILE (me) ---------------------- */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: Number(req.user.id) },
      select: {
        id: true,
        username: true,
        email: true,
        phoneNumber: true,
        preferredLanguage: true,
        avatarUrl: true, // private filename; use POST /avatar response for signed URL
        emojiTag: true,
        role: true,
        plan: true,

        // prefs & toggles used by UI
        enableSmartReplies: true,
        showReadReceipts: true,
        allowExplicitContent: true,
        privacyBlurEnabled: true,
        privacyHoldToReveal: true,
        notifyOnCopy: true,

        // NEW: age prefs for Random Chat
        ageBand: true,
        ageAttestedAt: true,
        wantsAgeFilter: true,
        randomChatAllowedBands: true,
      },
    });
    res.json(me);
  } catch (e) {
    console.error('GET /users/me failed', e);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

/* ---------------------- UPDATE (me) ---------------------- */
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const {
      // Existing prefs
      enableSmartReplies,
      showReadReceipts,
      allowExplicitContent,
      privacyBlurEnabled,
      privacyHoldToReveal,
      notifyOnCopy,
      preferredLanguage,

      // NEW: age prefs
      ageBand,
      wantsAgeFilter,
      randomChatAllowedBands,
    } = req.body ?? {};

    const data = {};

    // existing toggles...
    if (typeof enableSmartReplies === 'boolean') data.enableSmartReplies = enableSmartReplies;
    if (typeof showReadReceipts === 'boolean') data.showReadReceipts = showReadReceipts;
    if (typeof allowExplicitContent === 'boolean') data.allowExplicitContent = allowExplicitContent;
    if (typeof privacyBlurEnabled === 'boolean') data.privacyBlurEnabled = privacyBlurEnabled;
    if (typeof privacyHoldToReveal === 'boolean') data.privacyHoldToReveal = privacyHoldToReveal;
    if (typeof notifyOnCopy === 'boolean') data.notifyOnCopy = notifyOnCopy;
    if (typeof preferredLanguage === 'string' && preferredLanguage.trim()) {
      data.preferredLanguage = preferredLanguage.trim().slice(0, 16);
    }

    // NEW: ageBand + filter prefs (safety rules)
    const AGE_VALUES = ['TEEN_13_17','ADULT_18_24','ADULT_25_34','ADULT_35_49','ADULT_50_PLUS'];

    if (typeof ageBand === 'string' && AGE_VALUES.includes(ageBand)) {
      data.ageBand = ageBand;
      data.ageAttestedAt = new Date(); // remember attestation time
    }

    if (typeof wantsAgeFilter === 'boolean') {
      data.wantsAgeFilter = wantsAgeFilter;
    }

    // randomChatAllowedBands must be valid strings; adults cannot include teens; teens forced to teen-only
    if (Array.isArray(randomChatAllowedBands)) {
      const cleaned = randomChatAllowedBands
        .map(String)
        .filter((v) => AGE_VALUES.includes(v));

      const meBand = ageBand || (
        await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { ageBand: true },
        })
      )?.ageBand;

      if (meBand === 'TEEN_13_17') {
        data.randomChatAllowedBands = ['TEEN_13_17']; // force teen-only
        data.wantsAgeFilter = true; // ensure on
      } else {
        data.randomChatAllowedBands = cleaned.filter((v) => v !== 'TEEN_13_17'); // adults: never include teens
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await prisma.user.update({
      where: { id: Number(req.user.id) },
      data,
      select: {
        id: true,
        enableSmartReplies: true,
        showReadReceipts: true,
        allowExplicitContent: true,
        privacyBlurEnabled: true,
        privacyHoldToReveal: true,
        notifyOnCopy: true,
        preferredLanguage: true,

        // return the age prefs too
        ageBand: true,
        ageAttestedAt: true,
        wantsAgeFilter: true,
        randomChatAllowedBands: true,
      },
    });

    res.json(updated);
  } catch (e) {
    console.error('PATCH /users/me failed', e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;

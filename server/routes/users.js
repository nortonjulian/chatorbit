import express from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { verifyToken, requireAdmin } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { validateRegistrationInput } from '../utils/validateUser.js';

// 🔐 secure upload utilities
import { makeUploader } from '../utils/upload.js';
import { scanFile } from '../utils/antivirus.js';
import { signDownloadToken } from '../utils/downloadTokens.js';

import path from 'path';
import fs from 'fs';

const router = express.Router();
const prisma = new PrismaClient();

// ---------------------- ADMIN: paginated users list ----------------------
// Mounted under /admin/users in index.js via app.use('/admin/users', adminUsersRouter)
router.get(
  '/',
  verifyToken,
  requireAdmin,
  audit('users.list', {
    resource: 'user',
    redactor: (req, _res) => ({ query: req.query ?? {}, note: 'admin list' }),
  }),
  async (req, res) => {
    try {
      const limit = Math.min(Math.max(1, Number(req.query.limit ?? 50)), 200);
      const cursor = req.query.cursor ? Number(req.query.cursor) : null;

      const items = await prisma.user.findMany({
        orderBy: { id: 'desc' },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          username: true,
          email: true,
          phoneNumber: true,
          preferredLanguage: true,
          createdAt: true,
          role: true,
        },
      });

      const nextCursor = items.length === limit ? items[items.length - 1].id : null;
      return res.json({ items, nextCursor });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// ---------------------- PUBLIC: create user ----------------------
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

// ---------------------- USER SEARCH ----------------------
router.get('/search', verifyToken, async (req, res) => {
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
        ? { id: true, username: true, email: true, phoneNumber: true, preferredLanguage: true }
        : { id: true, username: true, phoneNumber: true, preferredLanguage: true },
      take: 10,
    });

    res.json(users);
  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ---------------------- UPDATE (self or admin) ----------------------
router.patch('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { preferredLanguage, allowExplicitContent, showOriginalWithTranslation } = req.body;

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

// ---------------------- AVATAR UPLOAD (hardened) ----------------------
// Use the avatar bucket and stricter limits
const uploadAvatar = makeUploader({ maxFiles: 1, maxBytes: 5 * 1024 * 1024, kind: 'avatar' });

router.post('/avatar', verifyToken, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Optional AV check (non-blocking stub can be replaced with real ClamAV)
    const abs = req.file.path;
    const av = await scanFile(abs);
    if (!av.ok) {
      await fs.promises.unlink(abs).catch(() => {});
      return res.status(400).json({ error: 'File failed security scan' });
    }

    // Store only a private relative filename (no public /uploads path)
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
});

// ---------------------- PUBLIC KEY UPLOAD ----------------------
router.post('/keys', verifyToken, async (req, res) => {
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

// ---------------------- EMOJI TAG ----------------------
router.patch('/emoji', verifyToken, async (req, res) => {
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

// ---------------------- PROFILE (me) ----------------------
router.get('/me', verifyToken, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: Number(req.user.id) },
      select: {
        id: true,
        username: true,
        email: true,
        phoneNumber: true,
        preferredLanguage: true,
        avatarUrl: true, // now stores a private filename; use POST /avatar response for signed URL
        emojiTag: true,
        role: true,
        enableSmartReplies: true,
      },
    });
    res.json(me);
  } catch (e) {
    console.error('GET /users/me failed', e);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// ---------------------- UPDATE (me) ----------------------
router.patch('/me', verifyToken, async (req, res) => {
  try {
    const { enableSmartReplies } = req.body ?? {};
    const data = {};

    if (typeof enableSmartReplies === 'boolean') {
      data.enableSmartReplies = enableSmartReplies;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await prisma.user.update({
      where: { id: Number(req.user.id) },
      data,
      select: { id: true, enableSmartReplies: true },
    });

    res.json(updated);
  } catch (e) {
    console.error('PATCH /users/me failed', e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;

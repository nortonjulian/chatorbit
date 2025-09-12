import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

import prisma from '../utils/prismaClient.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/authSchemas.js';
import { setCsrfCookie } from '../middleware/csrf.js';

import { generateKeyPair } from '../utils/encryption.js';
import { issueResetToken, consumeResetToken } from '../utils/resetTokens.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET; // asserted in server entrypoint

/* =========================
 *  Cookie helpers (config)
 * ========================= */

function getCookieName() {
  return process.env.JWT_COOKIE_NAME || 'orbit_jwt';
}
function getCookieCommon() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || String(process.env.COOKIE_SECURE) === 'true',
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    domain: process.env.COOKIEDOMAIN || process.env.COOKIE_DOMAIN || undefined,
    path: process.env.COOKIE_PATH || '/',
  };
}
/** Set signed-in JWT as an HTTP-only cookie */
function setJwtCookie(res, token) {
  res.cookie(getCookieName(), token, {
    ...getCookieCommon(),
    maxAge: 30 * 24 * 3600 * 1000, // 30d
  });
}
/** Clear the auth cookie */
function clearJwtCookie(res) {
  res.clearCookie(getCookieName(), { ...getCookieCommon(), maxAge: undefined });
}

/* =========================
 *        Nodemailer
 * ========================= */

let transporter;
(async () => {
  try {
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
    }
  } catch {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
})();

/* =========================
 *         ROUTES
 * ========================= */

// CSRF helper for SPA: sets XSRF-TOKEN cookie you will echo in "X-CSRF-Token" header
router.get('/csrf-token', (req, res) => {
  setCsrfCookie(req, res);
  res.json({ ok: true });
});

// Register
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { username, email, password, preferredLanguage = 'en' } = req.body;

    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) return res.status(409).json({ error: 'Email already in use' });

    const existingByUsername = await prisma.user.findUnique({ where: { username } });
    if (existingByUsername) return res.status(409).json({ error: 'Username already in use' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const { publicKey, privateKey } = generateKeyPair();

    // Create; prefer `password` field but remain compatible if schema uses `passwordHash`
    let user;
    try {
      user = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          preferredLanguage,
          role: 'USER',
          plan: 'FREE',
          publicKey,
          privateKey: null, // never store private key
        },
        select: { id: true, email: true, username: true, role: true, plan: true, publicKey: true },
      });
    } catch (e) {
      // Fallback for schemas that use `passwordHash`
      user = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash: hashedPassword,
          preferredLanguage,
          role: 'USER',
          plan: 'FREE',
          publicKey,
          privateKey: null,
        },
        select: { id: true, email: true, username: true, role: true, plan: true, publicKey: true },
      });
    }

    // Issue JWT and set cookie so the user is signed in immediately after register
    const payload = { id: user.id, username: user.username, role: user.role, plan: user.plan };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
    setJwtCookie(res, token);

    return res.status(201).json({
      message: 'user registered',
      user: {
        id: user.id,
        email: user.email,        // include email for tests
        username: user.username,
        publicKey: user.publicKey,
        plan: user.plan,
        role: user.role,
      },
      privateKey, // one-time return to client for safe storage
    });
  })
);

// Login
router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    // loginSchema should allow either {email,password} or {username,password}
    const { email, username, password } = req.body;

    const user =
      (email && (await prisma.user.findUnique({ where: { email } }))) ||
      (username && (await prisma.user.findUnique({ where: { username } })));

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // Support either column name
    const storedHash = user.passwordHash || user.password;
    const ok = storedHash ? await bcrypt.compare(password, storedHash) : false;
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const payload = { id: user.id, username: user.username, role: user.role, plan: user.plan || 'FREE' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

    setJwtCookie(res, token);

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,        // include email for parity
        username: user.username,
        role: user.role,
        plan: user.plan || 'FREE',
      },
    });
  })
);

// Logout
router.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    clearJwtCookie(res);
    res.json({ ok: true });
  })
);

// Who am I?
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = await prisma.user.findUnique({
      where: { id: Number(req.user.id) },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        plan: true,
        preferredLanguage: true,
        showOriginalWithTranslation: true,
        allowExplicitContent: true,
        enableAIResponder: true,
        enableSmartReplies: true,
        autoResponderMode: true,
        autoResponderCooldownSec: true,
        autoResponderActiveUntil: true,
        autoResponderSignature: true,
        autoDeleteSeconds: true,
        showReadReceipts: true,
        avatarUrl: true,
        emojiTag: true,
      },
    });
    if (!me) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ user: me });
  })
);

// Short-lived token (e.g., for sockets)
router.get(
  '/token',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      plan: req.user.plan || 'FREE',
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
    res.json({ token });
  })
);

// Forgot password
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'user not found' });

    const token = await issueResetToken(user.id);
    const base = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
    const resetLink = `${base.replace(/\/+$/, '')}/reset-password?token=${token}`;

    const info = await transporter.sendMail({
      from: '"ChatOrbit Support" <no-reply@chatorbit.com>',
      to: email,
      subject: 'Reset Your ChatOrbit Password',
      html: `<p>Hello ${user.username},</p>
        <p>Click below to reset your password. This link will expire shortly.</p>
        <p><a href="${resetLink}">Reset Password</a></p>
        <p>If you didn’t request this, you can safely ignore this email.</p>`,
    });

    return res.json({
      message: 'Password reset link sent',
      previewURL: nodemailer.getTestMessageUrl(info) || null,
    });
  })
);

// Reset password
router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

    const userId = await consumeResetToken(token);
    if (!userId) return res.status(400).json({ error: 'Invalid or expired token' });

    const hashed = await bcrypt.hash(newPassword, 10);

    // Update whichever column your schema uses
    try {
      await prisma.user.update({ where: { id: Number(userId) }, data: { password: hashed } });
    } catch {
      await prisma.user.update({ where: { id: Number(userId) }, data: { passwordHash: hashed } });
    }

    return res.json({ message: 'Password reset successful' });
  })
);

export default router;

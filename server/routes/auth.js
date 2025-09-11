import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';

import { requireAuth } from '../middleware/auth.js';
import { validateRegistrationInput } from '../utils/validateUser.js';
import { generateKeyPair } from '../utils/encryption.js';
import { issueResetToken, consumeResetToken } from '../utils/resetTokens.js';

const router = express.Router();

import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET; // asserted in index.js

/* =========================
 *  Cookie helpers (config)
 * ========================= */

function getCookieName() {
  return process.env.JWT_COOKIE_NAME || 'orbit_jwt';
}
function getCookieCommon() {
  return {
    httpOnly: true,
    secure: String(process.env.COOKIE_SECURE) === 'true',
    sameSite: process.env.COOKIE_SAMESITE || 'Lax', // 'Lax' | 'Strict' | 'None'
    domain: process.env.COOKIEDOMAIN || process.env.COOKIE_DOMAIN || undefined, // e.g. ".chatorbit.com"
    path: process.env.COOKIE_PATH || '/',
  };
}
/** Set signed-in JWT as an HTTP-only cookie */
function setJwtCookie(res, token) {
  res.cookie(getCookieName(), token, {
    ...getCookieCommon(),
    maxAge: 7 * 24 * 3600 * 1000, // 7 days
  });
}
/** Clear the auth cookie */
function clearJwtCookie(res) {
  res.clearCookie(getCookieName(), getCookieCommon());
}
/** Read JWT from request cookies (returns payload or null) */
function readJwtFromCookies(req) {
  const token = req.cookies?.[getCookieName()];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET); // { id, username, role, plan, iat, exp }
  } catch {
    return null;
  }
}

/* =========================
 *      Rate limiters
 * ========================= */

const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many registration attempts, please try again later.' },
});
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later.' },
});
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: {
    error: 'Too many password reset attempts, please try again later.',
  },
});

/* =========================
 *        Nodemailer
 * ========================= */

let transporter;
(async () => {
  // If you have real SMTP env vars, switch to them here
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  } catch (e) {
    // Fallback: create a no-op transporter to avoid crashes
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
})();

/* =========================
 *         ROUTES
 * ========================= */

// Register
router.post('/register', registerLimiter, async (req, res) => {
  const { username, email, password, preferredLanguage } = req.body;

  const validationError = validateRegistrationInput(username, email, password);
  if (validationError) return res.status(400).json({ error: { message: validationError } });

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return res.status(409).json({ error: 'Email already in use' });

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate public/private key pair for encryption
    const { publicKey, privateKey } = generateKeyPair();

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        preferredLanguage: preferredLanguage || 'en',
        role: 'USER',
        plan: 'FREE',
        publicKey,
        privateKey: null, // do not store private key server-side
      },
    });

    // Return the private key once so the client can store it securely
    res.status(201).json({
      message: 'user registered',
      user: {
        id: user.id,
        username: user.username,
        publicKey: user.publicKey,
        plan: user.plan,
        role: user.role,
      },
      privateKey,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login (cookie-only auth)
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res
      .status(400)
      .json({ error: 'Username and password are required' });

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user)
      return res.status(401).json({ error: 'Invalid username or password' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).json({ error: 'Invalid username or password' });

    // ✅ Add plan into JWT payload
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      plan: user.plan || 'FREE',
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    // ✅ Set HttpOnly cookie (no token in JSON)
    setJwtCookie(res, token);

    // Minimal response; client can call /auth/me to hydrate
    res.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        plan: user.plan || 'FREE',
      },
    });
  } catch (error) {
    console.error('Login error', error);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// Logout (clears cookie)
router.post('/logout', (_req, res) => {
  clearJwtCookie(res);
  return res.json({ message: 'Logged out successfully' });
});

// Who am I? (reads cookie)
router.get('/me', requireAuth, async (req, res) => {
  const me = await prisma.user.findUnique({
    where: { id: Number(req.user.id) },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      plan: true, // <-- important
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
});

// 🔐 Short-lived JWT for WS clients & load tests (requires existing cookie auth)
router.get('/token', requireAuth, (req, res) => {
  const payload = {
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    plan: req.user.plan || 'FREE',
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  res.json({ token });
});

// Forgot password (issues Redis-backed token and emails link)
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'user not found' });

    const token = await issueResetToken(user.id);

    // Build link for your frontend
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

    res.json({
      message: 'Password reset link sent to your email',
      previewURL: nodemailer.getTestMessageUrl(info), // handy in dev
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process forgot password' });
  }
});

// Reset password (consumes Redis token)
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ error: 'Token and new password required' });

  try {
    const userId = await consumeResetToken(token);
    if (!userId) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: Number(userId) },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;

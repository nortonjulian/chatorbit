import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { validateRegistrationInput } from '../utils/validateUser.js';
import { generateKeyPair } from '../utils/encryption.js';
import { verifyTokenOptional } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET; // must be set (server/index.js already asserts this)
const RESET_TOKEN_EXPIRATION = 1000 * 60 * 15;

// In-memory reset token store (for demo; ideally use Redis or DB)
const resetTokens = new Map();

// Nodemailer (test account by default)
let transporter;
(async () => {
  // If you have real SMTP in env, swap to that here
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
})();

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
  message: { error: 'Too many password reset attempts, please try again later.' },
});

/** Set signed-in JWT as an HTTP-only cookie */
function setJwtCookie(res, token) {
  const name = process.env.JWT_COOKIE_NAME || 'orbit_jwt';
  const secure = String(process.env.COOKIE_SECURE) === 'true';
  const sameSite = process.env.COOKIE_SAMESITE || 'Lax'; // 'Lax' | 'Strict' | 'None'
  const domain = process.env.COOKIE_DOMAIN || undefined; // e.g. .example.com in prod
  const path = process.env.COOKIE_PATH || '/';

  res.cookie(name, token, {
    httpOnly: true,
    secure,
    sameSite,
    domain,
    path,
    maxAge: 7 * 24 * 3600 * 1000, // 7 days
  });
}

/** Clear the auth cookie */
function clearJwtCookie(res) {
  const name = process.env.JWT_COOKIE_NAME || 'orbit_jwt';
  res.clearCookie(name, {
    httpOnly: true,
    secure: String(process.env.COOKIE_SECURE) === 'true',
    sameSite: process.env.COOKIE_SAMESITE || 'Lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: process.env.COOKIE_PATH || '/',
  });
}

/* =========================
 *        ROUTES
 * ========================= */

router.post('/register', registerLimiter, async (req, res) => {
  const { username, email, password, preferredLanguage } = req.body;

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

    // Generate public/private key pair for encryption
    const { publicKey, privateKey } = generateKeyPair();

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        preferredLanguage: preferredLanguage || 'en',
        role: 'USER',
        publicKey,
        privateKey: null, // don’t store private key server-side
      },
    });

    // Return the private key once so the client can store it securely
    res.status(201).json({
      message: 'user registered',
      user: { id: user.id, username: user.username, publicKey: user.publicKey },
      privateKey,
    });
  } catch (error) {
    console.log('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' });

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid username or password' });

    const payload = { id: user.id, username: user.username, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    // HTTP-only cookie (no token in JSON)
    setJwtCookie(res, token);

    // Return a minimal body (client can fetch /users/me after)
    res.json({
      ok: true,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (error) {
    console.log('Login error', error);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

router.post('/logout', verifyTokenOptional, (req, res) => {
  clearJwtCookie(res);
  res.json({ ok: true });
});

router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'user not found' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiration = Date.now() + RESET_TOKEN_EXPIRATION;

    resetTokens.set(token, { userId: user.id, expiration });

    const resetLink = `http://localhost:5173/reset-password?token=${token}`;

    const info = await transporter.sendMail({
      from: '"ChatOrbit Support" <no-reply@chatorbit.com>',
      to: email,
      subject: 'Reset Your ChatOrbit Password',
      html: `<p>Hello ${user.username},</p>
        <p>Click below to reset your password. This link will expire in 15 minutes.</p>
        <a href="${resetLink}">Reset Password</a>`,
    });

    res.json({
      message: 'Password reset link sent to your email',
      previewURL: nodemailer.getTestMessageUrl(info),
    });
  } catch (error) {
    console.log('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process forgot password' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword)
    return res.status(400).json({ error: 'Token and new password required' });

  try {
    const tokenData = resetTokens.get(token);

    if (!tokenData || tokenData.expiration < Date.now()) {
      return res.status(400).json({ error: 'invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: tokenData.userId },
      data: { password: hashedPassword },
    });

    resetTokens.delete(token);

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.log('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;

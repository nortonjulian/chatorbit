import crypto from 'node:crypto';
import prisma from '../utils/prismaClient.js';

const TTL_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 30);
const IS_TEST = String(process.env.NODE_ENV || '') === 'test';

// --- tiny in-memory fallback for tests only ---
const mem = new Map(); // token -> { userId, expMs }

/** sha256 hex */
function hashToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Create a plaintext token and store ONLY its hash in DB.
 * In NODE_ENV=test, uses in-memory map.
 * @returns {Promise<string>} plaintext token (email this!)
 */
export async function issueResetToken(userId) {
  if (IS_TEST) {
    const token = crypto.randomUUID();
    mem.set(token, { userId: Number(userId), expMs: Date.now() + TTL_MINUTES * 60 * 1000 });
    return token;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);

  // one active token per user
  await prisma.passwordResetToken.deleteMany({ where: { userId: Number(userId), usedAt: null } });

  await prisma.passwordResetToken.create({
    data: { userId: Number(userId), tokenHash, expiresAt },
  });

  return token;
}

/**
 * Consume (one-time) a plaintext token.
 * In NODE_ENV=test, reads from in-memory map.
 * @returns {Promise<number|null>} userId if valid; otherwise null
 */
export async function consumeResetToken(plaintextToken) {
  if (IS_TEST) {
    const rec = mem.get(plaintextToken);
    if (!rec) return null;
    mem.delete(plaintextToken);
    if (rec.expMs < Date.now()) return null;
    return Number(rec.userId);
  }

  const tokenHash = hashToken(plaintextToken);

  const rec = await prisma.passwordResetToken.findFirst({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!rec) return null;
  if (rec.usedAt) return null;
  if (rec.expiresAt && rec.expiresAt.getTime() < Date.now()) return null;

  await prisma.passwordResetToken.update({
    where: { id: rec.id },
    data: { usedAt: new Date() },
  });

  return rec.userId;
}

/** Delete expired + old used tokens */
export async function purgeResetTokens(days = 7) {
  if (IS_TEST) {
    // GC memory tokens
    for (const [tok, v] of mem.entries()) {
      if (v.expMs < Date.now()) mem.delete(tok);
    }
    return;
  }
  const now = new Date();
  const cutoffForUsed = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.passwordResetToken.deleteMany({ where: { usedAt: { not: null, lt: cutoffForUsed } } });
}

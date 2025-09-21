import crypto from 'node:crypto';
import prisma from './prismaClient.js';

const TOKEN_BYTES = 32;      // 256-bit random -> 64 hex chars
const TTL_MINUTES = 30;      // token validity window

/**
 * Create a new reset token for a user and return the PLAINTEXT token.
 * We store only the SHA-256 hash in the DB.
 * Also removes any previous unused tokens for that user (one-active-at-a-time).
 */
export async function issueResetToken(userId) {
  const plaintext = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);

  // Optional hygiene: only one active token per user
  await prisma.passwordResetToken.deleteMany({
    where: { userId: Number(userId), usedAt: null },
  });

  await prisma.passwordResetToken.create({
    data: { userId: Number(userId), tokenHash, expiresAt },
  });

  return plaintext;
}

/**
 * Validate and consume a reset token. Returns the userId if valid, else null.
 * Marks token as used (idempotent consumption).
 */
export async function consumeResetToken(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return null;
  const tokenHash = crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');

  const rec = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, userId: true },
  });

  if (!rec) return null;

  await prisma.passwordResetToken.update({
    where: { id: rec.id },
    data: { usedAt: new Date() },
  });

  return rec.userId;
}

/**
 * Test/maintenance helper: purge tokens.
 * By default removes EXPIRED tokens only.
 * Options:
 *  - expiredOnly: boolean (default true). If false, deletes all that match userId filter.
 *  - userId: number | string | undefined — limit purge to one user.
 */
export async function purgeResetTokens({ expiredOnly = true, userId } = {}) {
  const where = {};
  if (expiredOnly) {
    where.expiresAt = { lt: new Date() };
  }
  if (userId != null) {
    where.userId = Number(userId);
  }
  await prisma.passwordResetToken.deleteMany({ where });
}

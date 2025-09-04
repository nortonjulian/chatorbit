import crypto from 'crypto';
import { ensureRedis, redisKv } from './redisClient.js';

const PREFIX = 'pwreset:'; // namespace prefix for reset tokens
const TTL_SEC = Number(process.env.RESET_TOKEN_TTL_SEC || 15 * 60); // default 15 minutes

/**
 * Issue a one-time reset token for a user.
 * @param {number|string} userId - The user ID to tie the token to.
 * @returns {Promise<string>} token
 */
export async function issueResetToken(userId) {
  await ensureRedis();

  const token = crypto.randomBytes(32).toString('hex'); // secure random
  const key = `${PREFIX}${token}`;

  // Redis EX sets TTL automatically
  await redisKv.setEx(key, TTL_SEC, String(userId));

  return token;
}

/**
 * Consume a reset token.
 * Returns userId if valid, null if expired/invalid.
 * Token is deleted immediately after being read.
 *
 * @param {string} token
 * @returns {Promise<number|null>}
 */
export async function consumeResetToken(token) {
  await ensureRedis();

  const key = `${PREFIX}${token}`;
  const userId = await redisKv.get(key);

  if (!userId) return null; // missing or expired

  await redisKv.del(key); // enforce one-time use
  return Number(userId);
}

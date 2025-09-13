import crypto from 'crypto';

const isTest = process.env.NODE_ENV === 'test';

// Simple in-memory store for tests/dev
const mem = new Map(); // token -> { userId, exp }

const TTL_MS = 15 * 60 * 1000;

export async function issueResetToken(userId) {
  const token = crypto.randomUUID();
  const exp = Date.now() + TTL_MS;

  if (isTest) {
    mem.set(token, { userId: Number(userId), exp });
    return token;
  }

  // TODO: implement Redis/DB storage here for production
  mem.set(token, { userId: Number(userId), exp });
  return token;
}

export async function consumeResetToken(token) {
  const rec = mem.get(token);
  if (!rec) return null;
  mem.delete(token);
  if (rec.exp < Date.now()) return null;
  return Number(rec.userId);
}

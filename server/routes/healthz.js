import express from 'express';
import prisma from '../utils/prismaClient.js';

let redisClient = null;
async function getRedis() {
  if (redisClient !== null) return redisClient;
  if (!process.env.REDIS_URL) return null;
  const { default: IoRedis } = await import('ioredis');
  redisClient = new IoRedis(process.env.REDIS_URL, { lazyConnect: true });
  try { await redisClient.connect?.(); } catch {}
  return redisClient;
}

const router = express.Router();
router.get('/', async (_req, res) => {
  const startedAt = Date.now();
  const checks = { db: { ok: false }, redis: { ok: true } };

  // DB
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db.ok = true;
  } catch (e) {
    checks.db.ok = false;
    checks.db.error = e.message;
  }

  // Redis (optional)
  try {
    const r = await getRedis();
    if (r) {
      const t0 = Date.now();
      const pong = await r.ping();
      checks.redis.ok = (pong === 'PONG');
      checks.redis.latencyMs = Date.now() - t0;
    } else {
      checks.redis.ok = true;      // treat as passing if not configured
      checks.redis.skipped = true;
    }
  } catch (e) {
    checks.redis.ok = false;
    checks.redis.error = e.message;
  }

  const ok = Object.values(checks).every(c => c.ok);
  const status = ok ? 200 : 503;
  res.status(status).json({
    ok,
    uptimeSec: Math.round(process.uptime()),
    version: process.env.GIT_COMMIT_SHA || 'dev',
    node: process.version,
    checks,
    durationMs: Date.now() - startedAt,
  });
});
export default router;

import { createClient } from 'redis';

const url = process.env.REDIS_URL || 'redis://localhost:6379';

// --- Pub/Sub clients (for Socket.IO adapter) ---
export const redisPub = createClient({ url });
export const redisSub = createClient({ url });

// --- General-purpose client (legacy use) ---
export const redis = createClient({ url });

// --- Dedicated KV client (tokens, app data) ---
export const redisKv = createClient({ url });

// Error logging
[redisPub, redisSub, redis, redisKv].forEach((c, i) =>
  c.on('error', (e) => console.error(`Redis client ${i} error:`, e))
);

let ready = false;
export async function ensureRedis() {
  if (ready) return { redis, redisPub, redisSub, redisKv };
  await Promise.all([
    redis.connect(),
    redisPub.connect(),
    redisSub.connect(),
    redisKv.connect(),
  ]);
  ready = true;
  return { redis, redisPub, redisSub, redisKv };
}

// --- JSON helpers (using redisKv) ---
export async function rSetJSON(key, val, ttlSec) {
  const payload = JSON.stringify(val);
  if (ttlSec) return redisKv.set(key, payload, { EX: ttlSec });
  return redisKv.set(key, payload);
}

export async function rGetJSON(key) {
  const s = await redisKv.get(key);
  return s ? JSON.parse(s) : null;
}

import { createClient } from 'redis';

const url = process.env.REDIS_URL || 'redis://localhost:6379';

// Use separate clients for pub/sub (required by socket.io adapter)
export const redisPub = createClient({ url });
export const redisSub = createClient({ url });

// (Optional) a general client if you want a non-pubsub connection too
export const redis = createClient({ url });

redisPub.on('error', (e) => console.error('Redis pub error:', e));
redisSub.on('error', (e) => console.error('Redis sub error:', e));
redis.on('error', (e) => console.error('Redis error:', e));

let ready = false;
export async function ensureRedis() {
  if (ready) return { redis, redisPub, redisSub };
  await Promise.all([redis.connect(), redisPub.connect(), redisSub.connect()]);
  ready = true;
  return { redis, redisPub, redisSub };
}

// Small JSON helpers (optional)
export async function rSetJSON(key, val, ttlSec) {
  const payload = JSON.stringify(val);
  if (ttlSec) return redis.set(key, payload, { EX: ttlSec });
  return redis.set(key, payload);
}
export async function rGetJSON(key) {
  const s = await redis.get(key);
  return s ? JSON.parse(s) : null;
}

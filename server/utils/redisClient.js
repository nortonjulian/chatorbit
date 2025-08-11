// server/utils/redisClient.js
import { createClient } from 'redis';

const url = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = createClient({ url });

redis.on('error', (e) => console.error('Redis error:', e));

let ready = false;
export async function ensureRedis() {
  if (ready) return redis;
  await redis.connect();
  ready = true;
  return redis;
}

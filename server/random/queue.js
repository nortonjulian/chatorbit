import { redis, rSetJSON, rGetJSON } from '../utils/redisClient.js';

const WAITING_LIST = 'random:waiting';

export async function enqueueWaiting(userObj) {
  await redis.lPush(WAITING_LIST, JSON.stringify(userObj));
}

export async function tryDequeuePartner() {
  const raw = await redis.rPop(WAITING_LIST);
  return raw ? JSON.parse(raw) : null;
}

export async function savePair(roomId, a, b) {
  await rSetJSON(`random:pairs:${roomId}`, { a, b }, 60 * 30); // 30m TTL
}

export async function getPair(roomId) {
  return rGetJSON(`random:pairs:${roomId}`);
}

export async function deletePair(roomId) {
  await redis.del(`random:pairs:${roomId}`);
}

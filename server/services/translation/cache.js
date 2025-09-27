const store = new Map();
// seconds (e.g., 86400 = 24h). 0/undefined disables.
const ttlSec = Number(process.env.TRANSLATION_CACHE_TTL_SECONDS || 0);
// Optional hard cap to avoid unbounded memory.
const maxEntries = Number(process.env.TRANSLATION_CACHE_MAX || 5000);

function now() { return Date.now(); }

export function getCached(key) {
  if (!ttlSec || !key) return null;
  const rec = store.get(key);
  if (!rec) return null;
  if (rec.exp <= now()) { store.delete(key); return null; }
  return rec.val;
}

export function setCached(key, val) {
  if (!ttlSec || !key) return;
  if (store.size >= maxEntries) {
    // Drop oldest entry (naive). For real LRU, keep a queue.
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }
  store.set(key, { val, exp: now() + ttlSec * 1000 });
}

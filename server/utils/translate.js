import crypto from 'crypto';
import { v2 } from '@google-cloud/translate';
import { ensureRedis } from './redisClient.js';

const { Translate } = v2;
const translate = new Translate({ key: process.env.GOOGLE_API_KEY });

// tiny in-memory fallback cache
const mem = new Map();
const MEM_MAX = 500;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const memGet = (k) => mem.get(k);
const memSet = (k, v) => {
  mem.set(k, v);
  if (mem.size > MEM_MAX) mem.delete(mem.keys().next().value);
};

/**
 * Get a cached translation or translate+cache.
 * Redis key: tr:<sha256(text)>:<lang>
 */
async function translateWithCache(text, lang, ttlSec = 60 * 60 * 24 * 30) {
  const key = `tr:${sha256(text)}:${lang}`;

  // 1) Mem cache
  const mHit = memGet(key);
  if (mHit) return mHit;

  // 2) Redis
  try {
    const r = await ensureRedis();
    const rHit = await r.get(key);
    if (rHit) {
      memSet(key, rHit);
      return rHit;
    }
  } catch (e) {
    // Redis down? fall through to live translate
  }

  // 3) Live translate
  const [translated] = await translate.translate(text, lang);

  // 4) Write-through caches
  memSet(key, translated);
  try {
    const r = await ensureRedis();
    await r.setEx(key, ttlSec, translated);
  } catch {}

  return translated;
}

/**
 * Translate to multiple target languages (skips senderLang and dups).
 */
export async function translateForTargets(content, senderLang, targetLangs) {
  const unique = [...new Set((targetLangs || []).filter((l) => l && l !== senderLang))];
  if (!content || unique.length === 0) return { map: {}, from: senderLang };

  const out = {};
  for (const lang of unique) {
    try {
      out[lang] = await translateWithCache(content, lang);
    } catch (e) {
      console.error(`Translation to ${lang} failed:`, e);
    }
  }
  return { map: out, from: senderLang };
}

// Single-language helper (for on-the-fly path below)
export async function translateOne(content, lang) {
  if (!content || !lang) return null;
  return translateWithCache(content, lang);
}

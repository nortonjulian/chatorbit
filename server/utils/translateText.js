import fetch from 'node-fetch';
import Boom from '@hapi/boom';
import { LRU } from './lru.js';
import { asyncPool } from './asyncPool.js';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const DEEPL_KEY = process.env.DEEPL_API_KEY;

// Cache up to ~2k unique translations; default TTL 10 minutes
const CACHE_TTL_MS = Number(process.env.TRANSLATE_CACHE_TTL_MS ?? 10 * 60 * 1000);
const cache = new LRU(Number(process.env.TRANSLATE_CACHE_SIZE ?? 2000));

/** Provider: DeepL (preferred when key present) */
async function deeplTranslate({ text, targetLang, sourceLang }) {
  const resp = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      text,
      target_lang: targetLang.toUpperCase(),
      ...(sourceLang ? { source_lang: sourceLang.toUpperCase() } : {}),
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw Boom.badGateway(`DEEPL ${resp.status}: ${body.slice(0, 200)}`);
  }

  const json = await resp.json();
  const translatedText = json?.translations?.[0]?.text ?? '';
  const detectedSourceLang =
    json?.translations?.[0]?.detected_source_language ?? (sourceLang?.trim() || null);

  return { translatedText, detectedSourceLang, provider: 'deepl' };
}

/** Provider: OpenAI (fallback) */
async function openaiTranslate({ text, targetLang, sourceLang }) {
  const system = `You are a translator. Translate the user's message to ${targetLang}. Return only the translation.`;
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.TRANSLATE_MODEL || 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        ...(sourceLang
          ? [{ role: 'system', content: `Source language hint: ${sourceLang}` }]
          : []),
        { role: 'user', content: text },
      ],
      max_tokens: 400,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw Boom.badGateway(`OpenAI ${resp.status}: ${body.slice(0, 200)}`);
  }

  const json = await resp.json();
  const translatedText = json?.choices?.[0]?.message?.content?.trim() ?? '';
  return {
    translatedText,
    detectedSourceLang: sourceLang?.trim() || null,
    provider: 'openai',
  };
}

/** One-shot translation via preferred provider (DeepL → OpenAI → echo) */
async function translateOnce({ text, targetLang, sourceLang }) {
  // Prefer DeepL if configured
  if (DEEPL_KEY) {
    try {
      return await deeplTranslate({ text, targetLang, sourceLang });
    } catch (e) {
      // fall through to OpenAI if available
      if (!OPENAI_KEY) throw e;
    }
  }

  // Fallback: OpenAI
  if (OPENAI_KEY) {
    return await openaiTranslate({ text, targetLang, sourceLang });
  }

  // No provider keys? Echo back to avoid breaking flows
  return {
    translatedText: text,
    detectedSourceLang: sourceLang?.trim() || null,
    provider: 'noop',
  };
}

/**
 * translateText({ text, targetLang, sourceLang?, extraTargets? })
 * - Returns the primary translation quickly (uses cache)
 * - Optionally warms cache for extraTargets in parallel (limited concurrency)
 * - Return shape keeps backward-compat `translated` and adds richer fields
 */
export async function translateText({
  text,
  targetLang,
  sourceLang,
  extraTargets = [],
}) {
  if (!text || !targetLang) throw Boom.badRequest('text and targetLang required');

  const norm = (s) => (s ?? '').toString().trim();
  const t = norm(text);
  const tgt = norm(targetLang);
  const src = norm(sourceLang || '');

  const key = `v1|${src}|${tgt}|${t}`;
  if (cache.has(key)) {
    const cached = cache.get(key);
    return {
      text: t,
      translatedText: cached,
      translated: cached, // backward compat
      targetLang: tgt,
      detectedSourceLang: src || null,
      provider: 'cache',
    };
  }

  // Primary translation — the only awaited call (user-facing latency)
  const primary = await translateOnce({
    text: t,
    targetLang: tgt,
    sourceLang: src || undefined,
  });
  cache.set(key, primary.translatedText, CACHE_TTL_MS);

  // Fire-and-forget warming for other viewer languages (bounded concurrency)
  const uniqueExtras = [...new Set(extraTargets.filter((x) => x && x !== tgt))];
  if (uniqueExtras.length) {
    const CONCURRENCY = Number(process.env.TRANSLATE_FANOUT_CONCURRENCY ?? 4);

    asyncPool(CONCURRENCY, uniqueExtras, async (lang) => {
      const k = `v1|${src}|${lang}|${t}`;
      if (cache.has(k)) return;

      try {
        const r = await translateOnce({
          text: t,
          targetLang: lang,
          sourceLang: src || undefined,
        });
        cache.set(k, r.translatedText, CACHE_TTL_MS);
      } catch {
        // swallow background warming failures
      }
    }).catch(() => {});
  }

  return {
    text: t,
    translatedText: primary.translatedText,
    translated: primary.translatedText, // backward compat
    targetLang: tgt,
    detectedSourceLang: primary.detectedSourceLang ?? (src || null),
    provider: primary.provider,
  };
}

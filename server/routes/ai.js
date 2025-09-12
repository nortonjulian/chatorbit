import express from 'express';
import Boom from '@hapi/boom';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler.js';
import { translateText } from '../utils/translateText.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePremium } from '../middleware/requirePremium.js';

const router = express.Router();

// e.g., 20 requests per minute per IP for all AI endpoints
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply limiter to all AI routes
router.use(aiLimiter);

/** robust JSON extractor */
function tryParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {}
  const m = str?.match?.(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {}
  }
  const a = str?.match?.(/\[[\s\S]*\]/);
  if (a) {
    try {
      return JSON.parse(a[0]);
    } catch {}
  }
  return null;
}

// basic profanity masker (opt-in)
function maskProfanity(s) {
  if (!s) return s;
  const words = (process.env.AI_PROFANITY_WORDS || '')
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  if (!words.length) return s;
  const re = new RegExp(`\\b(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
  return s.replace(re, (m) => m[0] + '*'.repeat(Math.max(0, m.length - 2)) + (m.length > 1 ? m[m.length - 1] : ''));
}

async function callOpenAIForSuggestions({ snippets, locale }) {
  const safe = (snippets || []).slice(-3).map((s) => ({
    role: s.role,
    text: String(s.text || '').slice(0, 500),
    author: s.author || '',
  }));

  const system = [
    'You generate concise, helpful reply suggestions.',
    'Return JSON ONLY like: {"suggestions":[{"text":"..."},{"text":"..."}]}',
    '- 2–3 options maximum',
    '- <= 60 characters each',
    "- mirror the user's language",
    '- no URLs, no emojis, no personal data',
  ].join('\n');

  const userContent = [
    locale ? `Locale hint: ${locale}` : '',
    'Conversation (latest last):',
    ...safe.map(
      (s) =>
        `${s.role?.toUpperCase?.() || 'USER'}(${s.author || 'user'}): ${s.text}`
    ),
  ]
    .filter(Boolean)
    .join('\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SUGGEST_MODEL || 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 120,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw Boom.badGateway(`LLM error: ${res.status} ${txt || res.statusText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  const json = tryParseJson(text) || { suggestions: [] };
  return (json.suggestions || [])
    .map((x) => (typeof x === 'string' ? { text: x } : x))
    .filter((x) => x?.text)
    .slice(0, 3);
}

// ============================
// Premium-only: power feature
// ============================
router.post(
  '/power-feature',
  requireAuth,
  requirePremium,
  asyncHandler(async (req, res) => {
    // TODO: replace with your real advanced AI logic
    // You can safely assume the user is premium here
    return res.json({
      ok: true,
      result: '✨ Premium AI result (replace with real logic)',
    });
  })
);

// POST /ai/suggest-replies (Free by default; you may gate later)
router.post(
  '/suggest-replies',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { snippets, locale, filterProfanity } = req.body || {};
    if (!Array.isArray(snippets) || snippets.length === 0) {
      throw Boom.badRequest('snippets required');
    }

    // Input length guard (total recent text)
    const totalLen = snippets.reduce((n, s) => n + (s?.text?.length || 0), 0);
    const maxChars = Number(process.env.AI_SUGGEST_MAX_INPUT || 4000);
    if (totalLen > maxChars) {
      throw Boom.entityTooLarge(`snippets too long (>${maxChars} chars)`);
    }

    const suggestions = await callOpenAIForSuggestions({ snippets, locale });

    // Optional profanity masking
    const masked = filterProfanity
      ? suggestions.map((s) => ({ ...s, text: maskProfanity(s.text) }))
      : suggestions;

    return res.json({ suggestions: masked });
  })
);

// POST /ai/translate (Free by default; you may gate later)
// NOTE: translateText() should implement 10m cache, autodetect, DeepL->OpenAI fallback.
router.post(
  '/translate',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { text, targetLang, sourceLang, maxChars = 5000 } = req.body ?? {};
    if (!text || !targetLang) {
      throw Boom.badRequest('text and targetLang required');
    }
    if (String(text).length > Number(maxChars)) {
      throw Boom.entityTooLarge(`text too long (>${maxChars} chars)`);
    }
    const out = await translateText({ text, targetLang, sourceLang });
    return res.json(out);
  })
);

export default router;

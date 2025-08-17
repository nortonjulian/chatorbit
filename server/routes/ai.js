import express from 'express';
import Boom from '@hapi/boom';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler.js';
import { translateText } from '../utils/translateText.js';
import { verifyToken } from '../middleware/auth.js';

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
    ...safe.map((s) => `${s.role?.toUpperCase?.() || 'USER'}(${s.author || 'user'}): ${s.text}`),
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

// POST /ai/suggest-replies
router.post(
  '/suggest-replies',
  verifyToken,
  asyncHandler(async (req, res) => {
    const { snippets, locale } = req.body || {};
    if (!Array.isArray(snippets) || snippets.length === 0) {
      throw Boom.badRequest('snippets required');
    }
    const suggestions = await callOpenAIForSuggestions({ snippets, locale });
    return res.json({ suggestions });
  })
);

// POST /ai/translate
router.post(
  '/translate',
  verifyToken,
  asyncHandler(async (req, res) => {
    const { text, targetLang, sourceLang } = req.body ?? {};
    if (!text || !targetLang) {
      throw Boom.badRequest('text and targetLang required');
    }
    const out = await translateText({ text, targetLang, sourceLang });
    return res.json(out);
  })
);

export default router;

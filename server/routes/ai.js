import express from 'express';
import * as Boom from '@hapi/boom';
import { suggestLimiter, translateLimiter } from '../rateLimit.js';
import { translateText } from '../utils/translateText.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

/** robust JSON extractor */
function tryParseJson(str) {
  try { return JSON.parse(str); } catch {}
  const m = str.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch {} }
  const a = str.match(/\[[\s\S]*\]/); if (a) { try { return JSON.parse(a[0]); } catch {} }
  return null;
}

async function callOpenAIForSuggestions({ snippets, locale }) {
  const safe = (snippets || []).slice(-3).map(s => ({
    role: s.role,
    text: String(s.text || '').slice(0, 500),
    author: s.author || '',
  }));

  const system = [
    'You generate concise, helpful reply suggestions.',
    'Return JSON ONLY like: {"suggestions":[{"text":"..."},{"text":"..."}]}',
    '- 2–3 options maximum',
    '- <= 60 characters each',
    '- mirror the user\'s language',
    '- no URLs, no emojis, no personal data',
  ].join('\n');

  const userContent = [
    locale ? `Locale hint: ${locale}` : '',
    'Conversation (latest last):',
    ...safe.map(s => `${s.role.toUpperCase()}(${s.author||'user'}): ${s.text}`)
  ].filter(Boolean).join('\n');

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
    const txt = await res.text();
    throw Boom.badGateway(`LLM error: ${res.status} ${txt}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  const json = tryParseJson(text) || { suggestions: [] };
  return (json.suggestions || [])
    .map(x => (typeof x === 'string' ? { text: x } : x))
    .filter(x => x?.text)
    .slice(0, 3);
}

// Suggest replies
router.post('/suggest-replies', verifyToken, suggestLimiter, async (req, res, next) => {
  try {
    const { snippets, locale } = req.body || {};
    if (!Array.isArray(snippets) || !snippets.length) throw Boom.badRequest('snippets required');
    const suggestions = await callOpenAIForSuggestions({ snippets, locale });
    res.json({ suggestions });
  } catch (e) { next(e); }
});

// Translate
router.post('/translate', verifyToken, translateLimiter, async (req, res) => {
  try {
    const { text, targetLang, sourceLang } = req.body ?? {};
    if (!text || !targetLang) return res.status(400).json({ error: 'text and targetLang required' });
    const out = await translateText({ text, targetLang, sourceLang });
    res.json(out);
  } catch (e) {
    console.error('translate failed', e);
    res.status(500).json({ error: 'translate failed' });
  }
});

// Error handler
router.use((err, _req, res, _next) => {
  if (Boom.isBoom(err)) {
    const { output } = err;
    return res.status(output.statusCode).json(output.payload);
  }
  console.error(err);
  res.status(500).json({ statusCode: 500, error: 'Internal Server Error' });
});

export default router;

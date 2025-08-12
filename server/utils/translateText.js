import fetch from 'node-fetch';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const DEEPL_KEY  = process.env.DEEPL_API_KEY;

export async function translateText({ text, targetLang, sourceLang }) {
  if (!text || !targetLang) throw new Error('text/targetLang required');

  // Prefer DeepL if available (simple JSON API)
  if (DEEPL_KEY) {
    const resp = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: { 'Authorization': `DeepL-Auth-Key ${DEEPL_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        text,
        target_lang: targetLang.toUpperCase(),
        ...(sourceLang ? { source_lang: sourceLang.toUpperCase() } : {})
      })
    });
    const json = await resp.json();
    const translated = json?.translations?.[0]?.text;
    if (!translated) throw new Error('DEEPL failed');
    return { translated, provider: 'deepl', detectedLang: json?.translations?.[0]?.detected_source_language };
  }

  // Fallback: OpenAI chat (mini models are fast/cheap)
  if (OPENAI_KEY) {
    const system = `You are a translator. Translate the user's message to ${targetLang}. Return only the translation.`;
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          ...(sourceLang ? [{ role: 'system', content: `Source language hint: ${sourceLang}` }] : []),
          { role: 'user', content: text }
        ],
        temperature: 0
      })
    });
    const json = await resp.json();
    const translated = json?.choices?.[0]?.message?.content?.trim();
    if (!translated) throw new Error('OpenAI translate failed');
    return { translated, provider: 'openai', detectedLang: null };
  }

  // No provider keys? echo back
  return { translated: text, provider: 'noop', detectedLang: null };
}

import { detectLanguage, translateText } from './googleTranslate.js';
import { getCached, setCached } from './cache.js';

// Returns: { translatedText, detectedLang, confidence, provider }
export async function maybeTranslateForTarget(originalText, explicitSourceLang, targetLang) {
  const fallback = { translatedText: null, detectedLang: null, confidence: null, provider: 'none' };

  if (!originalText?.trim() || !targetLang) return fallback;

  const srcLang = explicitSourceLang ? String(explicitSourceLang).toLowerCase() : null;
  const tgt = String(targetLang).toLowerCase();

  // If source explicitly same as target, skip (still return detectedLang if provided).
  if (srcLang && srcLang === tgt) {
    return { ...fallback, detectedLang: srcLang };
  }

  const key = `v1:${srcLang || 'auto'}:${tgt}:${originalText}`;
  const cached = getCached(key);
  if (cached) return cached;

  let det = { language: srcLang || null, confidence: null, provider: 'none' };

  if (!srcLang) {
    try {
      det = await detectLanguage(originalText);
    } catch {
      det = { language: null, confidence: null, provider: 'google' };
    }
  }

  const detected = (det.language || srcLang || '').toLowerCase();

  // If same language -> no translation needed
  if (detected && detected === tgt) {
    const val = {
      translatedText: null,
      detectedLang: detected,
      confidence: det.confidence,
      provider: det.provider || 'google',
    };
    setCached(key, val);
    return val;
  }

  try {
    const { translated, provider } = await translateText(originalText, tgt);
    const val = {
      translatedText: translated || null,
      detectedLang: detected || null,
      confidence: det.confidence,
      provider: provider || det.provider || 'google',
    };
    setCached(key, val);
    return val;
  } catch {
    const val = {
      translatedText: null,
      detectedLang: detected || null,
      confidence: det.confidence,
      provider: det.provider || 'google',
    };
    setCached(key, val);
    return val;
  }
}

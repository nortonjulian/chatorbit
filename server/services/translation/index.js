// Import whatever your googleTranslate.js exports
import * as googleMod from './googleTranslate.js';

/**
 * Resolve a callable from googleTranslate.js.
 * Supports any of:
 *   export function translateBatchGoogle(texts, target)
 *   export function translateBatch(texts, target)
 *   export default function(texts, target)
 *   export default { translateBatch(texts, target) }
 */
function resolveGoogleImpl(mod) {
  if (typeof mod.translateBatchGoogle === 'function') return mod.translateBatchGoogle;
  if (typeof mod.translateBatch === 'function') return mod.translateBatch;
  if (typeof mod.default === 'function') return mod.default;
  if (mod.default && typeof mod.default.translateBatch === 'function') return mod.default.translateBatch;
  throw new Error(
    'googleTranslate.js must export translateBatchGoogle(), translateBatch(), a default function, or default { translateBatch }'
  );
}

const googleTranslate = resolveGoogleImpl(googleMod);

/**
 * Provider-agnostic wrapper used by the rest of the app.
 * @param {string[]|string} texts
 * @param {string} targetLanguage e.g., "en"
 * @returns {Promise<Array<{ text: string, detectedSourceLanguage: string|null }>>}
 */
export async function translateBatch(texts = [], targetLanguage = 'en') {
  const arr = Array.isArray(texts) ? texts : [String(texts || '')];
  if (arr.length === 0) return [];

  const results = await googleTranslate(arr, targetLanguage);

  // Normalize output to { text, detectedSourceLanguage }
  return (results || []).map((r) => ({
    text: r?.text ?? r?.translatedText ?? '',
    detectedSourceLanguage:
      r?.detectedSourceLanguage ?? r?.source ?? r?.detectedLanguageCode ?? null,
  }));
}

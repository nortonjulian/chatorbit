import { v2 as Translate } from '@google-cloud/translate';
import pRetry from 'p-retry';

const enabled = process.env.TRANSLATION_ENABLED === 'true';

let client = null;
if (enabled) {
  // Requires GOOGLE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS in env
  client = new Translate.Translate({
    projectId: process.env.GOOGLE_PROJECT_ID,
  });
}

export async function detectLanguage(text) {
  if (!enabled || !text?.trim()) {
    return { language: null, confidence: null, provider: 'none' };
  }

  const op = async () => {
    const [detections] = await client.detect(text);
    const det = Array.isArray(detections) ? detections[0] : detections;
    return {
      language: det?.language || null,
      confidence: typeof det?.confidence === 'number' ? det.confidence : null,
      provider: 'google',
    };
  };

  return pRetry(op, { retries: 3 });
}

export async function translateText(text, targetLang) {
  if (!enabled || !text?.trim() || !targetLang) {
    return { translated: null, provider: 'none' };
  }

  const op = async () => {
    const [translations] = await client.translate(text, targetLang);
    const translated = Array.isArray(translations) ? translations[0] : translations;
    return { translated, provider: 'google' };
  };

  return pRetry(op, { retries: 3 });
}

/**
 * BATCH TRANSLATION — what your resolver expects.
 * Returns array of { translatedText, detectedSourceLanguage }.
 */
export async function translateBatch(texts = [], target = 'en') {
  const arr = Array.isArray(texts) ? texts : [String(texts || '')];
  if (arr.length === 0) return [];

  // If disabled, echo back (useful for local dev)
  if (!enabled) {
    return arr.map(t => ({
      translatedText: t,
      detectedSourceLanguage: null,
    }));
  }

  const op = async () => {
    // v2 client accepts an array and returns an array of strings
    const [translations] = await client.translate(arr, target);
    const list = Array.isArray(translations) ? translations : [translations];
    // v2 translate() doesn’t return detected language unless you call detect() separately.
    // If you need it, you can call detectLanguage() per item; here we return null to keep it fast.
    return list.map(t => ({
      translatedText: t ?? '',
      detectedSourceLanguage: null,
    }));
  };

  return pRetry(op, { retries: 3 });
}

// Optional alias that your resolver also accepts
export const translateBatchGoogle = translateBatch;

// Default export so your resolver can pick that path too
export default translateBatch;

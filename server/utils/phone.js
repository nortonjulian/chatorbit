/**
 * Normalize input to strict E.164 format with +countrycode.
 * Returns null if invalid.
 */
export function normalizeE164(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  const digits = s.replace(/[^\d+]/g, '');
  if (!/^\+?[1-9]\d{7,14}$/.test(digits)) return null;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

/**
 * Validate if input looks like a proper E.164 number.
 */
export function isE164(input) {
  return normalizeE164(input) !== null;
}

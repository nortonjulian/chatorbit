// very small E.164 normalizer (no external deps)
export function normalizeE164(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  const digits = s.replace(/[^\d+]/g, '');
  // allow leading +; ensure at least country code + 7 digits (min 8 chars)
  if (!/^\+?[1-9]\d{7,14}$/.test(digits)) return null;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

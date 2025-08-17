import crypto from 'crypto';

export function signBody(secret, ts, bodyString) {
  const h = crypto.createHmac('sha256', secret);
  h.update(`${ts}.${bodyString}`);
  return `sha256=${h.digest('hex')}`;
}

export function verifySignature(
  secret,
  ts,
  bodyString,
  headerSig,
  toleranceSec = 300
) {
  const exp = Number(ts);
  if (!Number.isFinite(exp)) return false;
  const now = Date.now();
  if (Math.abs(now - exp) > toleranceSec * 1000) return false;

  const expected = signBody(secret, ts, bodyString);
  // timing-safe compare
  const a = Buffer.from(expected);
  const b = Buffer.from(headerSig || '');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

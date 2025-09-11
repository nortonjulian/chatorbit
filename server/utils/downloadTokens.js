import jwt from 'jsonwebtoken';

const MAX_TTL = 60 * 60; // 1h
const MIN_TTL = 30;      // 30s

function getSecret() {
  // allow tests to work without global setup
  const envSecret = process.env.FILE_TOKEN_SECRET;
  if (envSecret && envSecret.length > 0) return envSecret;
  if (process.env.NODE_ENV === 'test') return 'test-secret';
  throw new Error('FILE_TOKEN_SECRET is required for signed download URLs');
}

export function signDownloadToken({
  path,     // stored relative path (e.g., "avatars/123_abc.jpg")
  ownerId,  // numeric user id (optional if public)
  purpose = 'file',
  ttlSec = 300,
  audience = 'download',
  issuer = 'chat-orbit',
}) {
  const SECRET = getSecret();
  const exp = Math.min(Math.max(ttlSec, MIN_TTL), MAX_TTL);
  return jwt.sign(
    { p: path, o: ownerId ?? null, u: purpose, aud: audience, iss: issuer },
    SECRET,
    { expiresIn: exp }
  );
}

export function verifyDownloadToken(
  token,
  { audience = 'download', issuer = 'chat-orbit' } = {}
) {
  const SECRET = getSecret();
  const payload = jwt.verify(token, SECRET, { audience, issuer });
  // minimal shape checks
  if (!payload || typeof payload.p !== 'string' || payload.p.includes('..')) {
    // prevent traversal attempts; we only expect a sanitized relative filename
    throw new Error('Invalid token payload');
  }
  return {
    path: payload.p,
    ownerId: payload.o ?? null,
    purpose: payload.u ?? 'file',
  };
}

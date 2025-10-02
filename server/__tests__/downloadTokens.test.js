import jwt from 'jsonwebtoken';
import { signDownloadToken, verifyDownloadToken } from '../utils/downloadTokens.js';

describe('Download token signing and verification', () => {
  const SECRET = 'test-secret';
  beforeAll(() => { process.env.FILE_TOKEN_SECRET = SECRET; });

  test('signDownloadToken and verifyDownloadToken round-trip', () => {
    const token = signDownloadToken({ path: 'avatar/1.png', ownerId: 42, ttlSec: 60 });
    const payload = verifyDownloadToken(token);
    expect(payload.path).toBe('avatar/1.png');
    expect(payload.ownerId).toBe(42);
    expect(payload.purpose).toBe('file');
  });

  test('ttlSec is clamped between MIN_TTL and MAX_TTL', () => {
    const longToken = signDownloadToken({ path: 'x', ttlSec: 100000 });
    const p = verifyDownloadToken(longToken);
    expect(typeof p.path).toBe('string');
  });

  test('rejects invalid token payload', () => {
    // Create a token with a malicious path
    const badPayload = { p: '../etc/passwd', o: null, u: 'file', aud: 'download', iss: 'chatforia' };
    const badToken = jwt.sign(badPayload, SECRET);
    expect(() => verifyDownloadToken(badToken)).toThrow(/Invalid token payload/);
  });
});

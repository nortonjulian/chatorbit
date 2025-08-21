import { signBody, verifySignature } from '../utils/botSign.js';

describe('Bot signature functions', () => {
  const secret = 'supersecret';
  const body = 'test-body';
  const ts = Date.now().toString();

  test('signBody produces a sha256= hash', () => {
    const sig = signBody(secret, ts, body);
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  test('verifySignature returns true for valid signature', () => {
    const sig = signBody(secret, ts, body);
    expect(verifySignature(secret, ts, body, sig)).toBe(true);
  });

  test('verifySignature rejects invalid timestamp or signature', () => {
    const badSig = signBody(secret, ts, body).slice(0, 10) + 'invalid';
    expect(verifySignature(secret, 'not-a-number', body, badSig)).toBe(false);
    expect(verifySignature(secret, ts, body, 'sha256=wronghash')).toBe(false);
  });

  test('verifySignature respects time tolerance', () => {
    const oldTs = (Date.now() - 3600 * 1000).toString(); // 1 hour ago
    const sig = signBody(secret, oldTs, body);
    expect(verifySignature(secret, oldTs, body, sig)).toBe(false); // beyond default 5-min tolerance
  });
});

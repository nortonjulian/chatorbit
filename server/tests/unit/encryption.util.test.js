import { describe, it, expect } from 'vitest';
import { generateAesKey, encryptText, decryptText } from '../../utils/encryption.js';

describe('utils/encryption', () => {
  it('round-trips text with AES key', async () => {
    const key = await generateAesKey();
    const { iv, ciphertext } = await encryptText('hello unit', key);
    const out = await decryptText({ iv, ciphertext }, key);
    expect(out).toBe('hello unit');
  });
});

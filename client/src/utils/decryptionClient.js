import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';

/**
 * Decrypt a message for the current user (browser-safe).
 * @param {string} ciphertext - AES-encrypted message (base64: iv + tag + encrypted).
 * @param {string} encryptedSessionKey - Session key encrypted for the user (base64: nonce + box).
 * @param {string} userPrivateKey - User's private key (base64).
 * @param {string} senderPublicKey - Sender’s public key (base64).
 * @returns {string} - Decrypted message string.
 */
export async function decryptMessageForUserBrowser(
  ciphertext,
  encryptedSessionKey,
  userPrivateKey,
  senderPublicKey
) {
  const encryptedSessionKeyUint8 = naclUtil.decodeBase64(encryptedSessionKey);
  const userPrivateKeyUint8 = naclUtil.decodeBase64(userPrivateKey);
  const senderPublicKeyUint8 = naclUtil.decodeBase64(senderPublicKey);

  // Extract nonce + box
  const nonce = encryptedSessionKeyUint8.slice(0, 24);
  const box = encryptedSessionKeyUint8.slice(24);

  const sessionKey = nacl.box.open(box, nonce, senderPublicKeyUint8, userPrivateKeyUint8);

  if (!sessionKey) {
    throw new Error('Failed to decrypt session key');
  }

  const decoded = naclUtil.decodeBase64(ciphertext);
  const iv = decoded.subarray(0, 12);
  const tag = decoded.subarray(12, 28);
  const encrypted = decoded.subarray(28);

  const cryptoKey = await crypto.subtle.importKey('raw', sessionKey, 'AES-GCM', false, ['decrypt']);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    cryptoKey,
    concatUint8Arrays(encrypted, tag)
  );

  return new TextDecoder().decode(decryptedBuffer);
}

function concatUint8Arrays(a, b) {
  const result = new Uint8Array(a.length + b.length);
  result.set(a);
  result.set(b, a.length);
  return result;
}

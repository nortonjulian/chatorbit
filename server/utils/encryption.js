// utils/encryption.js
import crypto from 'crypto';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

const toU8 = (buf) => new Uint8Array(buf); // Buffer -> Uint8Array

export function generateKeyPair() {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: naclUtil.encodeBase64(keyPair.publicKey),
    privateKey: naclUtil.encodeBase64(keyPair.secretKey),
  };
}

/**
 * AES-256-GCM message encryption; session key sealed for each participant with NaCl box.
 * @param {string} message - UTF-8 plaintext
 * @param {UserLike} sender - { id, publicKey(base64), privateKey(base64) }
 * @param {UserLike[]} recipients - array with { id, publicKey(base64) }
 * @returns {{ciphertext:string, encryptedKeys:Object<string,string>}}
 */
export function encryptMessageForParticipants(message, sender, recipients) {
  // 1) Symmetric encrypt message
  const sessionKey = crypto.randomBytes(32);     // 256-bit
  const iv = crypto.randomBytes(12);             // GCM 96-bit IV
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey, iv);
  const enc = Buffer.concat([cipher.update(message, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([iv, tag, enc]).toString('base64');

  // 2) Seal session key to each participant using sender's secret key
  const senderSecret = naclUtil.decodeBase64(sender.privateKey);
  const senderPublic = naclUtil.decodeBase64(sender.publicKey);

  const encryptedKeys = {};

  // Recipients (everyone in room, excluding or including sender as separate step)
  for (const recipient of recipients) {
    const nonce = crypto.randomBytes(24);
    const recipientPublic = naclUtil.decodeBase64(recipient.publicKey);
    const boxed = nacl.box(toU8(sessionKey), toU8(nonce), recipientPublic, senderSecret);
    encryptedKeys[recipient.id] = naclUtil.encodeBase64(Buffer.concat([nonce, Buffer.from(boxed)]));
  }

  // Also seal to sender (so they can read from another device, or re-download)
  const selfNonce = crypto.randomBytes(24);
  const boxedSelf = nacl.box(toU8(sessionKey), toU8(selfNonce), senderPublic, senderSecret);
  encryptedKeys[sender.id] = naclUtil.encodeBase64(Buffer.concat([selfNonce, Buffer.from(boxedSelf)]));

  return { ciphertext, encryptedKeys };
}

/**
 * Decrypts a message for a user.
 * @param {string} ciphertext - base64 of [iv(12) | tag(16) | enc]
 * @param {string} encryptedSessionKey - base64 of [nonce(24) | box]
 * @param {string} currentUserPrivateKey - base64
 * @param {string} senderPublicKey - base64 of the key that sealed the session key
 * @returns {string} plaintext
 */
export function decryptMessageForUser(
  ciphertext,
  encryptedSessionKey,
  currentUserPrivateKey,
  senderPublicKey
) {
  const keyBuf = naclUtil.decodeBase64(encryptedSessionKey);
  const nonce = keyBuf.slice(0, 24);
  const boxData = keyBuf.slice(24);

  const sessionKeyU8 = nacl.box.open(
    boxData,
    nonce,
    naclUtil.decodeBase64(senderPublicKey),
    naclUtil.decodeBase64(currentUserPrivateKey)
  );
  if (!sessionKeyU8) throw new Error('Unable to decrypt session key');

  const sessionKey = Buffer.from(sessionKeyU8);

  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const enc = buf.slice(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

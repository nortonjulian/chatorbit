import crypto from 'crypto';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

// Optional worker pool; if absent, we fall back to inline sealing
let pool = null;
try {
  const { getCryptoPool } = await import('../services/cryptoPool.js');
  pool = getCryptoPool?.();
} catch {
  // No pool available – will seal inline when needed
}

// Threshold for switching to parallel sealing via worker threads
const PARALLEL_THRESHOLD = Number(process.env.ENCRYPT_PARALLEL_THRESHOLD || 8);

// Helper: Buffer → Uint8Array
const toU8 = (buf) => new Uint8Array(buf);

export function generateKeyPair() {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: naclUtil.encodeBase64(keyPair.publicKey),
    privateKey: naclUtil.encodeBase64(keyPair.secretKey),
  };
}

/**
 * Seal a session key for one recipient using the *sender's* keypair.
 * Output (base64) packs: [nonce(24) | box]
 */
function sealKeyInline(sessionKeyBuf, senderSecretB64, recipientPublicB64) {
  const nonce = crypto.randomBytes(24);
  const recipientPublic = naclUtil.decodeBase64(recipientPublicB64);
  const senderSecret = naclUtil.decodeBase64(senderSecretB64);

  const boxed = nacl.box(
    toU8(sessionKeyBuf),
    toU8(nonce),
    recipientPublic,
    senderSecret
  );
  const packed = Buffer.concat([nonce, Buffer.from(boxed)]);
  return naclUtil.encodeBase64(packed);
}

/**
 * AES-256-GCM message encryption; session key sealed for each participant with NaCl box.
 * @param {string} message - UTF-8 plaintext
 * @param {{ id:number, publicKey:string(base64), privateKey:string(base64) }} sender
 * @param {Array<{ id:number, publicKey:string(base64) }>} recipients
 * @returns {{ciphertext:string, encryptedKeys:Record<string,string>}}
 */
export async function encryptMessageForParticipants(
  message,
  sender,
  recipients
) {
  // 1) Symmetric encrypt the message once
  const sessionKey = crypto.randomBytes(32); // 256-bit key
  const iv = crypto.randomBytes(12); // GCM 96-bit IV
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey, iv);
  const enc = Buffer.concat([cipher.update(message, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([iv, tag, enc]).toString('base64');

  // 2) Dedupe recipients
  const encryptedKeys = {};
  const uniqueRecipients = [];
  const seen = new Set();
  for (const r of recipients || []) {
    if (!r?.id || !r?.publicKey) continue;
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    uniqueRecipients.push(r);
  }

  // Use worker pool for large groups if available
  const usePool = pool?.run && uniqueRecipients.length >= PARALLEL_THRESHOLD;
  if (usePool) {
    const senderSecretB64 = sender.privateKey;
    const msgKeyB64 = naclUtil.encodeBase64(sessionKey);

    const results = await Promise.all(
      uniqueRecipients.map(async (r) => {
        try {
          const out = await pool.run({
            msgKeyB64, // base64 of the session key
            senderSecretB64,
            recipientPubB64: r.publicKey,
          });
          return { userId: r.id, sealed: out.sealedKeyB64 };
        } catch {
          // Per-recipient fallback
          return {
            userId: r.id,
            sealed: sealKeyInline(sessionKey, sender.privateKey, r.publicKey),
          };
        }
      })
    );

    for (const { userId, sealed } of results) {
      encryptedKeys[userId] = sealed;
    }
  } else {
    // Small rooms → inline sealing
    for (const r of uniqueRecipients) {
      encryptedKeys[r.id] = sealKeyInline(
        sessionKey,
        sender.privateKey,
        r.publicKey
      );
    }
  }

  // Always seal to the sender (for multi-device/re-download)
  encryptedKeys[sender.id] = sealKeyInline(
    sessionKey,
    sender.privateKey,
    sender.publicKey
  );

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

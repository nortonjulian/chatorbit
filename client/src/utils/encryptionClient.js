import { get, set, del } from 'idb-keyval';
import { decryptMessageForUserBrowser } from './decryptionClient.js';

/* ============================================================
 * Tiny byte and WebCrypto helpers
 * ========================================================== */

const te = new TextEncoder();
const td = new TextDecoder();

const b642bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytes2b64 = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));

const hex2bytes = (hex) => {
  const s = hex.replace(/^0x/, '').toLowerCase();
  if (s.length % 2) throw new Error('Invalid hex length');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
};

const guessToBytes = (v) => {
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (typeof v === 'string') {
    // Heuristics: try base64 first; fallback to hex
    try {
      return b642bytes(v);
    } catch {
      return hex2bytes(v);
    }
  }
  throw new Error('Unsupported byte-like input');
};

const randBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

async function importAesKeyRaw(raw) {
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function importAesKey(key) {
  if (key instanceof CryptoKey) return key;
  const raw = guessToBytes(key);
  return importAesKeyRaw(raw);
}

/* ============================================================
 * At-rest key storage (encrypted with passcode)
 * ========================================================== */

const DB_KEY = 'chatforia:keys:v2'; // encrypted-at-rest record
const LEGACY_KEY = 'chatforia:keys:v1'; // old (plaintext) record if it exists

// In-memory cache of the derived key (cleared on lock)
let _derivedKey = null;
let _saltB64 = null;
let _iterations = 250_000;

function readLegacyLocalStorage() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function deriveAesKey(passcode, saltB64, iterations = 250_000) {
  const salt = b642bytes(saltB64);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    te.encode(passcode),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function aesGcmEncrypt(key, plaintextBytes) {
  const iv = randBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintextBytes);
  return { ivB64: bytes2b64(iv), ctB64: bytes2b64(ct) };
}

async function aesGcmDecrypt(key, ivB64, ctB64) {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b642bytes(ivB64) },
    key,
    b642bytes(ctB64)
  );
  return new Uint8Array(pt);
}

/** Save bundle encrypted with a passcode (used by install & migration). */
async function saveEncryptedBundle({ publicKey, privateKey }, passcode) {
  if (!publicKey || !privateKey) throw new Error('Missing keys');
  const saltB64 = bytes2b64(randBytes(16));
  const iterations = _iterations;
  const key = await deriveAesKey(passcode, saltB64, iterations);

  const payload = JSON.stringify({ publicKey, privateKey });
  const { ivB64, ctB64 } = await aesGcmEncrypt(key, te.encode(payload));

  const rec = {
    version: 'v2',
    createdAt: new Date().toISOString(),
    publicKey, // non-sensitive; useful without unlock
    enc: { saltB64, iterations, ivB64, ctB64 },
  };
  await set(DB_KEY, rec);

  _derivedKey = key;
  _saltB64 = saltB64;
  _iterations = iterations;

  return rec;
}

/** Internal: returns { publicKey, privateKey } if unlocked; else throws 'LOCKED'. */
async function getUnlockedBundleOrThrow() {
  // v2 path
  const rec = await get(DB_KEY);
  if (rec?.enc) {
    if (!_derivedKey) {
      throw new Error('LOCKED'); // user must unlock with passcode first
    }
    const { ivB64, ctB64 } = rec.enc;
    const pt = await aesGcmDecrypt(_derivedKey, ivB64, ctB64);
    const obj = JSON.parse(td.decode(pt));
    if (!obj?.privateKey || !obj?.publicKey) throw new Error('Corrupt key bundle');
    return obj;
  }
  // legacy fallbacks
  const legacyIdx = await get(LEGACY_KEY);
  if (legacyIdx?.privateKey && legacyIdx?.publicKey) return legacyIdx;

  const legacyLS = readLegacyLocalStorage();
  if (legacyLS?.privateKey && legacyLS?.publicKey) return legacyLS;

  throw new Error('No local keypair found');
}

/* ============================================================
 * Public: local key bundle metadata & management
 * ========================================================== */

export async function getLocalKeyBundleMeta() {
  const rec = await get(DB_KEY);
  if (rec)
    return {
      version: rec.version,
      createdAt: rec.createdAt,
      hasEncrypted: !!rec.enc,
      publicKey: rec.publicKey ?? null,
    };
  // also check legacy
  const legacy = (await get(LEGACY_KEY)) || readLegacyLocalStorage();
  if (legacy?.privateKey && legacy?.publicKey) {
    return {
      version: 'v1-legacy',
      createdAt: legacy.createdAt || null,
      hasEncrypted: false,
      publicKey: legacy.publicKey,
    };
  }
  return null;
}

export async function hasEncryptedBundle() {
  const rec = await get(DB_KEY);
  return !!rec?.enc;
}

export async function getPublicKeyNoUnlock() {
  const rec = await get(DB_KEY);
  if (rec?.publicKey) return rec.publicKey;
  const legacy = (await get(LEGACY_KEY)) || readLegacyLocalStorage();
  return legacy?.publicKey || null;
}

export async function enableKeyPasscode(passcode) {
  if (!passcode || passcode.length < 6) throw new Error('Passcode too short');

  // Try legacy from IndexedDB first
  let legacy = await get(LEGACY_KEY);
  if (!legacy) {
    const ls = readLegacyLocalStorage();
    if (ls) legacy = ls;
  }
  if (!legacy?.privateKey || !legacy?.publicKey) {
    throw new Error('No local keypair found to protect');
  }

  await saveEncryptedBundle(
    { publicKey: legacy.publicKey, privateKey: legacy.privateKey },
    passcode
  );

  // Clean legacy copies
  try {
    await del(LEGACY_KEY);
  } catch {}
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {}

  return true;
}

export async function unlockKeyBundle(passcode) {
  const rec = await get(DB_KEY);
  if (!rec?.enc) throw new Error('No encrypted bundle to unlock');

  const { saltB64, iterations, ivB64, ctB64 } = rec.enc;
  const key = await deriveAesKey(passcode, saltB64, iterations);
  const pt = await aesGcmDecrypt(key, ivB64, ctB64);
  const obj = JSON.parse(td.decode(pt));

  if (!obj?.privateKey || !obj?.publicKey) throw new Error('Corrupt key bundle');

  _derivedKey = key;
  _saltB64 = saltB64;
  _iterations = iterations;

  return obj; // { publicKey, privateKey }
}

export function lockKeyBundle() {
  _derivedKey = null;
  _saltB64 = null;
}

export async function clearLocalKeyBundle() {
  await del(DB_KEY);
  try {
    await del(LEGACY_KEY);
  } catch {}
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
  lockKeyBundle();
}

/* ============================================================
 * RSA key import (PEM/PKCS8 for private, SPKI for public)
 * ========================================================== */

/** Strips PEM headers/footers and whitespace; returns Uint8Array DER. */
function pemToDer(pem) {
  const s = String(pem || '')
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  return b642bytes(s);
}

async function importRsaPrivateKeyPkcs8(pemOrB64) {
  const der = pemToDer(pemOrB64);
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );
}

async function importRsaPublicKeySpki(pemOrB64) {
  const der = pemToDer(pemOrB64);
  return crypto.subtle.importKey(
    'spki',
    der,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
}

/**
 * Unwrap a per-recipient symmetric key for the current user.
 * - `encryptedKeyForMe`: typically base64 RSA-OAEP ciphertext from server.
 * Returns an AES-GCM CryptoKey ready for use with `decryptSym`.
 */
export async function unwrapForMe(encryptedKeyForMe) {
  if (!encryptedKeyForMe) throw new Error('Missing encryptedKeyForMe');

  // Ensure we have the user's private key available (unlocked or legacy)
  const { privateKey } = await getUnlockedBundleOrThrow();

  const rsaPriv = await importRsaPrivateKeyPkcs8(privateKey);
  const wrappedBytes = guessToBytes(encryptedKeyForMe);
  const rawAesKeyBytes = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, rsaPriv, wrappedBytes)
  );

  // Convert to usable AES-GCM key
  return importAesKeyRaw(rawAesKeyBytes);
}

/* ============================================================
 * Symmetric helpers (encrypt/decrypt)
 * ========================================================== */

/**
 * Decrypt AES-GCM payload and return plaintext (UTF-8 string).
 * Accepts key as CryptoKey, Uint8Array, ArrayBuffer, or base64/hex string.
 * `iv` and `ciphertext` can be Uint8Array or base64/hex strings.
 */
export async function decryptSym({ key, iv, ciphertext }) {
  const k = await importAesKey(key);
  const ivBytes = guessToBytes(iv);
  const ctBytes = guessToBytes(ciphertext);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, k, ctBytes);
  return td.decode(pt);
}

/**
 * Encrypt plaintext with a fresh 256-bit AES-GCM key.
 * Returns base64 iv/ct, algorithm tag, and the raw AES key bytes for wrapping.
 */
export async function encryptSym(plaintext) {
  const rawKey = randBytes(32); // 256-bit AES key
  const aesKey = await importAesKeyRaw(rawKey);
  const iv = randBytes(12);
  const ctBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    te.encode(String(plaintext ?? ''))
  );
  return {
    keyRaw: rawKey,              // Uint8Array (32 bytes)
    iv: bytes2b64(iv),           // base64
    ct: bytes2b64(ctBuf),        // base64
    alg: 'A256GCM',              // tag used by server/clients
  };
}

/* ============================================================
 * Message decryption pipeline (existing usage)
 * ========================================================== */

/**
 * Decrypts an array of messages for the current user.
 * Expects server to include `encryptedKeyForMe` (preferred) or legacy `encryptedKeys[currentUserId]`.
 * @param {Array} messages - Messages fetched from backend.
 * @param {string} currentUserPrivateKey - Base64/PEM private key (legacy path).
 * @param {Object} senderPublicKeys - Map senderId → publicKey (base64/PEM).
 * @param {number} currentUserId - ID of the logged-in user.
 */
export async function decryptFetchedMessages(
  messages,
  currentUserPrivateKey,
  senderPublicKeys,
  currentUserId
) {
  return Promise.all(
    messages.map(async (msg) => {
      try {
        const encryptedKey =
          msg.encryptedKeyForMe ??
          (msg.encryptedKeys && msg.encryptedKeys[currentUserId]) ??
          null;

        const senderPublicKey =
          senderPublicKeys?.[msg.sender?.id] || msg.sender?.publicKey || null;

        if (!encryptedKey || !senderPublicKey) {
          // Graceful UX: show placeholder and allow "request key" in future
          return { ...msg, decryptedContent: '[Encrypted – key unavailable]' };
        }

        const decrypted = await decryptMessageForUserBrowser(
          msg.contentCiphertext,
          encryptedKey,
          currentUserPrivateKey,
          senderPublicKey
        );

        return { ...msg, decryptedContent: decrypted };
      } catch (err) {
        console.warn(`Decryption failed for message ${msg.id}:`, err);
        return { ...msg, decryptedContent: '[Encrypted – could not decrypt]' };
      }
    })
  );
}

/* ============================================================
 * Reporting helper
 * ========================================================== */

export async function reportMessage(messageId, decryptedContent, reporterId) {
  return fetch('/messages/report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ messageId, reporterId, decryptedContent }),
  });
}

/* ============================================================
 * Provisioning helpers (primary ↔ new device)
 * ========================================================== */

export async function exportLocalPrivateKeyBundle(passcode) {
  const { publicKey, privateKey } = await unlockKeyBundle(passcode);
  return {
    version: 'v1',
    createdAt: new Date().toISOString(),
    publicKey,
    privateKey,
    meta: { source: 'primary-device' },
  };
}

export async function installLocalPrivateKeyBundle(received, passcode) {
  if (!received?.privateKey || !received?.publicKey) {
    throw new Error('Received bundle is missing keys');
  }
  if (!passcode) throw new Error('Passcode required to protect keys');

  await saveEncryptedBundle(
    { publicKey: received.publicKey, privateKey: received.privateKey },
    passcode
  );
  return true;
}

/* ============================================================
 * NEW: Wrap AES key for many recipients & high-level encryptForRoom
 * ========================================================== */

/**
 * Wrap a raw AES key (Uint8Array) for many recipients using RSA-OAEP.
 * `recipients` shape: [{ userId, keyId?, publicKey }, ...]
 * Returns: [{ userId, keyId, wrappedKey }, ...] with base64-wrapped keys.
 */
export async function wrapForMany(rawAesKey, recipients = []) {
  const out = [];
  const src = rawAesKey instanceof Uint8Array ? rawAesKey : guessToBytes(rawAesKey);

  for (const r of recipients) {
    if (!r || !r.publicKey || r.publicKey.length < 32) continue; // skip invalid
    try {
      const rsaPub = await importRsaPublicKeySpki(r.publicKey);
      const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaPub, src);
      out.push({
        userId: r.userId ?? r.id,
        keyId: r.keyId ?? r.publicKeyId ?? r.id,
        wrappedKey: bytes2b64(wrapped),
      });
    } catch (e) {
      // Skip recipients whose keys fail to import/encrypt (do not break send)
      console.warn('wrapForMany: failed to wrap for recipient', r?.userId ?? r?.id, e);
    }
  }

  return out;
}

/**
 * High-level encryptor used by the message composer.
 * - Generates a fresh AES-GCM key
 * - Encrypts plaintext once
 * - Wraps the AES key for each participant who has a publicKey
 * Returns: { iv, ct, alg, keyIds }
 */
export async function encryptForRoom(participants = [], plaintext = '') {
  // 1) symmetric encryption
  const { keyRaw, iv, ct, alg } = await encryptSym(plaintext);

  // 2) recipient list (id + publicKey)
  const recipients = (participants || [])
    .filter((p) => p && p.publicKey)
    .map((p) => ({
      userId: p.id,
      keyId: p.publicKeyId || p.id,
      publicKey: p.publicKey,
    }));

  // 3) wrap the AES key for each recipient
  const keyIds = await wrapForMany(keyRaw, recipients);

  // 4) return ciphertext + wrapped keys
  return { iv, ct, alg, keyIds };
}

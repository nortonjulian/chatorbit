// ------------------------------------------------------------
// Responsibilities in this file:
// 1) Decrypt fetched messages (your existing logic)
// 2) Report message helper (unchanged)
// 3) Local key storage with encrypt-at-rest (IndexedDB + WebCrypto)
// 4) Provisioning helpers used by Device Management UI
// ------------------------------------------------------------

import { get, set, del } from 'idb-keyval';
import { decryptMessageForUserBrowser } from './decryptionClient.js';

/**
 * Decrypts an array of messages for the current user.
 * @param {Array} messages - Messages fetched from backend.
 * @param {string} currentUserPrivateKey - Base64 private key.
 * @param {Object} senderPublicKeys - Object mapping senderId → publicKey (base64).
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
        const encryptedKey = msg.encryptedKeys?.[currentUserId];
        const senderPublicKey = senderPublicKeys?.[msg.sender?.id];

        if (!encryptedKey || !senderPublicKey) {
          throw new Error('Missing encrypted key or sender public key');
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
        return { ...msg, decryptedContent: '[Encrypted message]' };
      }
    })
  );
}

/**
 * Report a decrypted message to admins.
 */
export async function reportMessage(messageId, decryptedContent, reporterId) {
  return fetch('/messages/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId, reporterId, decryptedContent }),
  });
}

/* ============================================================
 * 2) LOCAL KEY STORAGE + ENCRYPT-AT-REST
 *    - IndexedDB via idb-keyval
 *    - PBKDF2(passcode, salt) → AES-GCM
 *    - Seamless migration from legacy plaintext storage
 * ========================================================== */

const DB_KEY = 'chatorbit:keys:v2';     // encrypted-at-rest record
const LEGACY_KEY = 'chatorbit:keys:v1'; // old (plaintext) record if it exists

// --- WebCrypto helpers ---
const te = new TextEncoder();
const td = new TextDecoder();

function b64(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
function ub64(b64s) { return Uint8Array.from(atob(b64s), c => c.charCodeAt(0)); }
function randBytes(n) { return crypto.getRandomValues(new Uint8Array(n)); }

async function deriveAesKey(passcode, saltB64, iterations = 250_000) {
  const salt = ub64(saltB64);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', te.encode(passcode), 'PBKDF2', false, ['deriveKey']
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
  return { ivB64: b64(iv), ctB64: b64(ct) };
}

async function aesGcmDecrypt(key, ivB64, ctB64) {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ub64(ivB64) },
    key,
    ub64(ctB64)
  );
  return new Uint8Array(pt);
}

// In-memory cache of the derived key (cleared on lock)
let _derivedKey = null;
let _saltB64 = null;
let _iterations = 250_000;

// --- Legacy (plaintext) reader: handles v1 migration from either IndexedDB or localStorage ---
function readLegacyLocalStorage() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Return the current stored bundle *metadata* (no secrets).
 * { version, createdAt, hasEncrypted, publicKey? }
 */
export async function getLocalKeyBundleMeta() {
  const rec = await get(DB_KEY);
  if (rec) return {
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

/** Do we already have an encrypted bundle? */
export async function hasEncryptedBundle() {
  const rec = await get(DB_KEY);
  return !!rec?.enc;
}

/** Convenience: get public key without unlocking (for display or uploads) */
export async function getPublicKeyNoUnlock() {
  const rec = await get(DB_KEY);
  if (rec?.publicKey) return rec.publicKey;
  const legacy = (await get(LEGACY_KEY)) || readLegacyLocalStorage();
  return legacy?.publicKey || null;
}

/** Save bundle encrypted with a passcode (used by install & migration). */
async function saveEncryptedBundle({ publicKey, privateKey }, passcode) {
  if (!publicKey || !privateKey) throw new Error('Missing keys');
  const saltB64 = b64(randBytes(16));
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

  // keep derived key in memory until lock (for UX)
  _derivedKey = key;
  _saltB64 = saltB64;
  _iterations = iterations;

  return rec;
}

/**
 * Enable passcode on existing (plaintext) storage by migrating legacy bundle.
 * Throws if no legacy bundle is available.
 */
export async function enableKeyPasscode(passcode) {
  if (!passcode || passcode.length < 6) throw new Error('Passcode too short');

  // Try legacy from IndexedDB first
  let legacy = await get(LEGACY_KEY);
  if (!legacy) {
    // Fallback to localStorage (older setups)
    const ls = readLegacyLocalStorage();
    if (ls) legacy = ls;
  }

  if (!legacy?.privateKey || !legacy?.publicKey) {
    throw new Error('No local keypair found to protect');
  }

  await saveEncryptedBundle({ publicKey: legacy.publicKey, privateKey: legacy.privateKey }, passcode);

  // Clean legacy copies
  try { await del(LEGACY_KEY); } catch {}
  try { localStorage.removeItem(LEGACY_KEY); } catch {}

  return true;
}

/**
 * Unlock the encrypted bundle with the passcode.
 * Keeps a derived key in-memory until lock for smoother UX.
 * Returns { publicKey, privateKey }.
 */
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

  return obj;
}

/** Forget the derived key (e.g., on manual lock or inactivity timeout). */
export function lockKeyBundle() {
  _derivedKey = null;
  _saltB64 = null;
}

/** Clear all stored key data (logout). */
export async function clearLocalKeyBundle() {
  await del(DB_KEY);
  try { await del(LEGACY_KEY); } catch {}
  try { localStorage.removeItem(LEGACY_KEY); } catch {}
  lockKeyBundle();
}

/* ============================================================
 * 3) PROVISIONING HELPERS (used by Device Management UI)
 *    These now require a passcode to decrypt/encrypt locally.
 * ========================================================== */

/**
 * Export the local private key bundle for provisioning (Primary device).
 * Requires passcode to decrypt the at-rest bundle.
 */
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

/**
 * Install a received bundle on this device (New device).
 * Immediately stores it encrypted-at-rest with the provided passcode.
 */
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

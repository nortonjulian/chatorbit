// ====== Shared helpers (local to this file) ======
export const backupVersion = 'kb1'; // key-backup version
export const chatBackupVersion = 'cb1'; // chat-backup version

const te_b = new TextEncoder();
const td_b = new TextDecoder();

function b64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
function ub64(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
function randBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

async function deriveBackupKey(password, saltB64, iterations = 250_000) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    te_b.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: ub64(saltB64), iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Read text from a variety of "file-like" inputs in tests/browsers.
 * Order matters to avoid coercing objects into "[object X]".
 */
async function readFileText(fileLike) {
  if (!fileLike) throw new Error('No file provided');

  // 1) Already a string
  if (typeof fileLike === 'string') return fileLike;

  // 2) Blob/File (covers browser File as well)
  if (typeof Blob !== 'undefined' && fileLike instanceof Blob) {
    if (typeof fileLike.text === 'function') {
      return await fileLike.text();
    }
    if (typeof fileLike.arrayBuffer === 'function') {
      const buf = await fileLike.arrayBuffer();
      return new TextDecoder().decode(buf);
    }
  }

  // 3) Objects exposing .text() directly
  if (typeof fileLike.text === 'function') {
    return await fileLike.text();
  }

  // 4) ArrayBuffer path
  if (typeof fileLike.arrayBuffer === 'function') {
    const buf = await fileLike.arrayBuffer();
    return new TextDecoder().decode(buf);
  }

  // 5) As a last resort, try Response wrapper (avoid when possible)
  if (typeof Response !== 'undefined') {
    try {
      return await new Response(fileLike).text();
    } catch {}
  }

  throw new Error('Unsupported file-like object: missing .text()/.arrayBuffer()');
}

// ============================================================
// 1) KEY BACKUP (password-encrypted key bundle)
// ============================================================

/**
 * Create an encrypted backup of the local key bundle.
 * Returns { blob, filename } for the caller to download.
 *
 * @param {{ unlockPasscode: string, backupPassword: string }} args
 * @param {{ exportLocalPrivateKeyBundle?: Function }} deps  (optional for tests)
 */
export async function createEncryptedKeyBackup(
  { unlockPasscode, backupPassword },
  deps = {}
) {
  if (!backupPassword || backupPassword.length < 6) {
    throw new Error('Backup password must be at least 6 chars');
  }

  let exportLocalPrivateKeyBundle = deps.exportLocalPrivateKeyBundle;
  if (!exportLocalPrivateKeyBundle) {
    // Lazily import in production
    ({ exportLocalPrivateKeyBundle } = await import('./encryptionClient.js'));
  }

  const bundle = await exportLocalPrivateKeyBundle(unlockPasscode); // { publicKey, privateKey }

  const saltB64 = b64(randBytes(16));
  const iterations = 250_000;
  const key = await deriveBackupKey(backupPassword, saltB64, iterations);

  const iv = randBytes(12);
  const plaintext = te_b.encode(
    JSON.stringify({
      publicKey: bundle.publicKey,
      privateKey: bundle.privateKey,
    })
  );

  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  const payload = {
    type: 'chatforia-key-backup',
    version: backupVersion,
    createdAt: new Date().toISOString(),
    kdf: { alg: 'PBKDF2-SHA256', saltB64, iterations },
    cipher: { alg: 'AES-GCM', ivB64: b64(iv) },
    ciphertextB64: b64(ct),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `chatforia-key-backup-${ts}.json`;
  return { blob, filename };
}

/**
 * Restore an encrypted key backup file and install keys locally
 *
 * @param {{ file: Blob|File|Response|string, backupPassword: string, setLocalPasscode: string }} args
 * @param {{ installLocalPrivateKeyBundle?: Function }} deps (optional for tests)
 */
export async function restoreEncryptedKeyBackup(
  { file, backupPassword, setLocalPasscode },
  deps = {}
) {
  if (!file) throw new Error('No backup file provided');
  if (!backupPassword || backupPassword.length < 6) throw new Error('Backup password too short');
  if (!setLocalPasscode || setLocalPasscode.length < 6) throw new Error('Local passcode too short');

  const text = await readFileText(file);
  const json = JSON.parse(text);
  if (json?.type !== 'chatforia-key-backup' || json?.version !== backupVersion) {
    throw new Error('Unsupported backup format');
  }

  const { kdf, cipher, ciphertextB64 } = json;
  const key = await deriveBackupKey(backupPassword, kdf.saltB64, kdf.iterations);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ub64(cipher.ivB64) },
    key,
    ub64(ciphertextB64)
  );
  const bundle = JSON.parse(td_b.decode(pt));

  let installLocalPrivateKeyBundle = deps.installLocalPrivateKeyBundle;
  if (!installLocalPrivateKeyBundle) {
    ({ installLocalPrivateKeyBundle } = await import('./encryptionClient.js'));
  }
  await installLocalPrivateKeyBundle(bundle, setLocalPasscode);
  return { ok: true };
}

// Backward-compat aliases (so older imports won’t break)
export {
  createEncryptedKeyBackup as createEncryptedChatBackup, // legacy alias (keys, not chats)
  restoreEncryptedKeyBackup as restoreEncryptedChatBackup, // legacy alias (keys, not chats)
};

// ============================================================
// 2) CHAT BACKUP (password-encrypted JSON of a room’s messages)
// ============================================================

/**
 * Create an encrypted backup for a single room’s messages.
 *
 * @param {{
 *  roomId: number,
 *  currentUserId: number,
 *  passcodeToUnlockKeys: string,
 *  password: string,
 *  fetchPage: Function,
 *  includeMedia?: boolean,
 *  fetchPublicKeys?: Function
 * }} args
 * @param {{ unlockKeyBundle?: Function, decryptFetchedMessages?: Function }} deps (optional for tests)
 *
 * @returns {Promise<{blob: Blob, filename: string}>}
 */
export async function createEncryptedRoomChatBackup(
  {
    roomId,
    currentUserId,
    passcodeToUnlockKeys,
    password,
    fetchPage,
    includeMedia = false,
    fetchPublicKeys = null,
  },
  deps = {}
) {
  if (!roomId) throw new Error('roomId required');
  if (!currentUserId) throw new Error('currentUserId required');
  if (!passcodeToUnlockKeys || passcodeToUnlockKeys.length < 6) {
    throw new Error('Passcode must be at least 6 chars');
  }
  if (!password || password.length < 6) {
    throw new Error('Backup password must be at least 6 chars');
  }
  if (typeof fetchPage !== 'function') {
    throw new Error('fetchPage function required');
  }

  let unlockKeyBundle = deps.unlockKeyBundle;
  let decryptFetchedMessages = deps.decryptFetchedMessages;

  if (!unlockKeyBundle || !decryptFetchedMessages) {
    const mod = await import('./encryptionClient.js');
    unlockKeyBundle = unlockKeyBundle || mod.unlockKeyBundle;
    decryptFetchedMessages = decryptFetchedMessages || mod.decryptFetchedMessages;
  }

  // Unlock the local private key (protected at rest)
  const { privateKey: currentUserPrivateKey } = await unlockKeyBundle(passcodeToUnlockKeys);

  const allDecrypted = [];
  let cursor = null;
  let first = true;

  do {
    const { items = [], nextCursor = null } = await fetchPage({
      roomId,
      limit: first ? 200 : 500,
      cursor,
    });
    first = false;
    if (!items.length) {
      cursor = nextCursor;
      continue;
    }

    // Build sender public key map from batch (if present)
    const senderKeyMap = {};
    const missingIds = new Set();
    for (const m of items) {
      const sid = m?.sender?.id;
      const k = m?.sender?.publicKey;
      if (sid) {
        if (k) senderKeyMap[sid] = k;
        else missingIds.add(sid);
      }
    }
    // Optionally fetch any missing pubkeys
    if (fetchPublicKeys && missingIds.size) {
      try {
        const fetched = await fetchPublicKeys(Array.from(missingIds));
        Object.assign(senderKeyMap, fetched || {});
      } catch {
        // ignore; decrypter will fall back to placeholder text
      }
    }

    // Decrypt this page for the current user
    const dec = await decryptFetchedMessages(
      items,
      currentUserPrivateKey,
      senderKeyMap,
      currentUserId
    );

    // Normalize to a JSON-safe shape
    for (const m of dec) {
      allDecrypted.push({
        id: m.id,
        createdAt: m.createdAt,
        sender: m.sender ? { id: m.sender.id, username: m.sender.username } : null,
        content: m.decryptedContent ?? m.translatedForMe ?? m.rawContent ?? '',
        isExplicit: !!m.isExplicit,
        expiresAt: m.expiresAt || null,
        attachments: Array.isArray(m.attachments)
          ? m.attachments.map((a) => ({
              id: a.id,
              kind: a.kind,
              url: includeMedia ? a.url : null, // URLs only; no binary
              mimeType: a.mimeType,
              width: a.width,
              height: a.height,
              durationSec: a.durationSec,
              caption: a.caption,
            }))
          : [],
        reactionSummary: m.reactionSummary || {},
        readBy: Array.isArray(m.readBy)
          ? m.readBy.map((u) => ({ id: u.id, username: u.username }))
          : [],
      });
    }

    cursor = nextCursor;
  } while (cursor);

  // Encrypt the chat JSON using the same PBKDF2/AES-GCM pattern
  const saltB64 = b64(randBytes(16));
  const iterations = 250_000;
  const key = await deriveBackupKey(password, saltB64, iterations);
  const iv = randBytes(12);

  const payload = {
    type: 'chatforia-chat-backup',
    version: chatBackupVersion,
    createdAt: new Date().toISOString(),
    room: { id: roomId },
    messageCount: allDecrypted.length,
    messages: allDecrypted,
    meta: { exportedByUserId: currentUserId, includeMedia },
  };

  const plaintext = te_b.encode(JSON.stringify(payload));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  const out = {
    type: 'chatforia-chat-backup',
    version: chatBackupVersion,
    createdAt: new Date().toISOString(),
    kdf: { alg: 'PBKDF2-SHA256', saltB64, iterations },
    cipher: { alg: 'AES-GCM', ivB64: b64(iv) },
    ciphertextB64: b64(ct),
  };

  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `chatforia-chat-room-${roomId}-${ts}.json`;
  return { blob, filename };
}

/**
 * Decrypt an encrypted chat backup file and return its JSON.
 * (Does NOT re-import to the server.)
 *
 * @param {{ file: Blob|File|Response|string, password: string }} args
 */
export async function restoreEncryptedRoomChatBackup({ file, password }) {
  if (!file) throw new Error('No backup file provided');
  if (!password || password.length < 6) throw new Error('Backup password too short');

  const text = await readFileText(file);
  const json = JSON.parse(text);
  if (json?.type !== 'chatforia-chat-backup' || json?.version !== chatBackupVersion) {
    throw new Error('Unsupported backup format');
  }

  const { kdf, cipher, ciphertextB64 } = json;
  const key = await deriveBackupKey(password, kdf.saltB64, kdf.iterations);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ub64(cipher.ivB64) },
    key,
    ub64(ciphertextB64)
  );
  return JSON.parse(td_b.decode(pt));
}

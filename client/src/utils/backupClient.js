export const backupVersion = 'kb1';
const te_b = new TextEncoder();
const td_b = new TextDecoder();

function b64(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
function ub64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function randBytes(n) { return crypto.getRandomValues(new Uint8Array(n)); }

async function deriveBackupKey(password, saltB64, iterations = 250_000) {
  const keyMaterial = await crypto.subtle.importKey('raw', te_b.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: ub64(saltB64), iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function createEncryptedKeyBackup({ unlockPasscode, backupPassword }) {
  if (!backupPassword || backupPassword.length < 6) throw new Error('Backup password must be at least 6 chars');
  // We lazily import from encryptionClient to avoid circular deps in bundlers
  const { exportLocalPrivateKeyBundle } = await import('./encryptionClient.js');
  const bundle = await exportLocalPrivateKeyBundle(unlockPasscode); // { publicKey, privateKey }

  const saltB64 = b64(randBytes(16));
  const iterations = 250_000;
  const key = await deriveBackupKey(backupPassword, saltB64, iterations);

  const iv = randBytes(12);
  const plaintext = te_b.encode(JSON.stringify({ publicKey: bundle.publicKey, privateKey: bundle.privateKey }));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  const payload = {
    type: 'chatorbit-key-backup',
    version: backupVersion,
    createdAt: new Date().toISOString(),
    kdf: { alg: 'PBKDF2-SHA256', saltB64, iterations },
    cipher: { alg: 'AES-GCM', ivB64: b64(iv) },
    ciphertextB64: b64(ct),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `chatorbit-key-backup-${ts}.json`;
  return { blob, filename };
}

export async function restoreEncryptedKeyBackup({ file, backupPassword, setLocalPasscode }) {
  if (!file) throw new Error('No backup file provided');
  if (!backupPassword || backupPassword.length < 6) throw new Error('Backup password too short');
  if (!setLocalPasscode || setLocalPasscode.length < 6) throw new Error('Local passcode too short');

  const text = await file.text();
  const json = JSON.parse(text);
  if (json?.type !== 'chatorbit-key-backup' || json?.version !== backupVersion) {
    throw new Error('Unsupported backup format');
  }
  const { kdf, cipher, ciphertextB64 } = json;
  const key = await deriveBackupKey(backupPassword, kdf.saltB64, kdf.iterations);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(cipher.ivB64) }, key, ub64(ciphertextB64));
  const bundle = JSON.parse(td_b.decode(pt));

  const { installLocalPrivateKeyBundle } = await import('./encryptionClient.js');
  await installLocalPrivateKeyBundle(bundle, setLocalPasscode);
  return { ok: true };
}

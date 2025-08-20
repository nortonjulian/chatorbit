/**
 * We run in plain Node (for stable WebCrypto) and avoid any File/Blob quirks
 * by passing a "fake file" with a .text() method.
 * @vitest-environment node
 */

import { describe, it, expect, vi } from 'vitest';

// Provide atob/btoa for Node
if (typeof globalThis.atob !== 'function') {
  globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
}
if (typeof globalThis.btoa !== 'function') {
  globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
}

// Mock the same module backupClient dynamically imports
vi.mock('../utils/encryptionClient.js', () => {
  return {
    exportLocalPrivateKeyBundle: vi.fn(async () => ({
      publicKey: 'PUB_b64',
      privateKey: 'PRIV_b64',
    })),
    installLocalPrivateKeyBundle: vi.fn(async () => true),
  };
});

// Import after mocking
import {
  createEncryptedKeyBackup,
  restoreEncryptedKeyBackup,
} from '../utils/backupClient.js';

// Helper to turn Blob into a string in Node 18+/20+
async function blobToTextPortable(blob) {
  if (blob && typeof blob.text === 'function') {
    return blob.text();
  }
  // Fallback: as a last resort construct a Response (undici is present in Node 18+)
  return new Response(blob).text();
}

describe('backupClient key backup', () => {
  it('creates and restores an encrypted key backup (fake file wrapper)', async () => {
    // Create the encrypted key backup (produces a Blob)
    const { blob, filename } = await createEncryptedKeyBackup({
      unlockPasscode: 'device-passcode-123456',
      backupPassword: 'backup-password-abcdef',
    });

    expect(filename).toMatch(/chatorbit-key-backup-/);

    // Convert the Blob -> JSON string
    const jsonString = await blobToTextPortable(blob);

    // Sanity check we actually have JSON
    const parsed = JSON.parse(jsonString);
    expect(parsed).toHaveProperty('type', 'chatorbit-key-backup');

    // Build a "fake file" that matches what restoreEncryptedKeyBackup expects
    const fakeFile = {
      text: async () => jsonString, // exactly what the code calls
    };

    const res = await restoreEncryptedKeyBackup({
      file: fakeFile,
      backupPassword: 'backup-password-abcdef',
      setLocalPasscode: 'new-device-passcode',
    });

    expect(res).toEqual({ ok: true });
  });
});

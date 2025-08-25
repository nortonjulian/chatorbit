/**
 * We run in plain Node (for stable WebCrypto) and avoid any File/Blob quirks
 * by passing a "fake file" with a .text() method.
 * @jest-environment node
 */

import { describe, it, expect, jest } from '@jest/globals';
import { webcrypto as nodeWebcrypto } from 'node:crypto';

// Vitest → Jest compatibility shim (must come before any vi.* calls)
globalThis.vi ||= {
  fn: jest.fn.bind(jest),
  spyOn: jest.spyOn.bind(jest),
  mock: jest.mock.bind(jest),
  unmock: jest.unmock?.bind(jest) ?? (() => {}),
  clearAllMocks: jest.clearAllMocks.bind(jest),
  resetAllMocks: jest.resetAllMocks.bind(jest),
  restoreAllMocks: jest.restoreAllMocks.bind(jest),
  useFakeTimers: jest.useFakeTimers.bind(jest),
  useRealTimers: jest.useRealTimers.bind(jest),
  advanceTimersByTime: jest.advanceTimersByTime.bind(jest),
  runAllTimers: jest.runAllTimers.bind(jest),
};

// Ensure WebCrypto API (crypto.subtle) exists in Node/Jest
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  globalThis.crypto = nodeWebcrypto;
}

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

// Helper to reliably turn a Blob/File/ArrayBuffer/etc into a UTF-8 string
async function bodyToString(body) {
  if (!body) return '';

  // 1) Blob/File: prefer .text(), else .arrayBuffer()
  if (typeof body.text === 'function') {
    try { return await body.text(); } catch {}
  }
  if (typeof body.arrayBuffer === 'function') {
    try {
      const ab = await body.arrayBuffer();
      return Buffer.from(ab).toString('utf8');
    } catch {}
  }

  // 2) If it's already a string
  if (typeof body === 'string') return body;

  // 3) Fallback via Response if available (Node 18+ / jsdom)
  if (typeof Response !== 'undefined') {
    try { return await new Response(body).text(); } catch {}
  }

  // 4) Last resort
  return String(body);
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
    const jsonString = await bodyToString(blob);

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

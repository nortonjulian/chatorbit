import { webcrypto as nodeWebcrypto } from 'node:crypto';

// Force-install WebCrypto even in jsdom where window.crypto is read-only
Object.defineProperty(globalThis, 'crypto', {
  value: nodeWebcrypto,
  configurable: true,
});

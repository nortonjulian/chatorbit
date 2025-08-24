// // Runs BEFORE test framework (crucial for libs that need globals at import time)
// const { TextEncoder, TextDecoder } = require('util');
// if (!global.TextEncoder) global.TextEncoder = TextEncoder;
// if (!global.TextDecoder) global.TextDecoder = TextDecoder;

// try {
//   // Provide Web Crypto if something calls crypto.subtle
//   const { webcrypto } = require('crypto');
//   if (!global.crypto) global.crypto = webcrypto;
// } catch {
//   /* ok if not available */
// }

// Polyfills that JSDOM/Jest don’t supply by default

// jest.polyfills.cjs

// 1) TextEncoder/TextDecoder (fixes original failures)
const { TextEncoder, TextDecoder } = require('node:util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// 2) Web Crypto if something calls crypto.subtle (safe to provide)
try {
  if (!global.crypto) {
    global.crypto = require('node:crypto').webcrypto;
  }
} catch {}

// 3) Minimal URL + createObjectURL stubs (sometimes used by libs)
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:jest-mock';
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}

// 4) ResizeObserver stub (needed for Mantine ScrollArea / Select portals)
if (!global.ResizeObserver) {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

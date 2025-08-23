// // client/jest.setup.cjs

// // Testing Library matchers
// require('@testing-library/jest-dom');

// // Polyfills for jsdom / node
// const { TextEncoder, TextDecoder } = require('util');
// global.TextEncoder = TextEncoder;
// global.TextDecoder = TextDecoder;

// // If anything uses Web Crypto APIs, this helps:
// try {
//   const { webcrypto } = require('crypto');
//   if (!global.crypto) {
//     global.crypto = webcrypto;
//   }
// } catch {
//   // ignore if not available
// }

// // Minimal import.meta.env shim for Vite-style env usage
// if (!globalThis.importMeta) {
//   globalThis.importMeta = { env: {} };
// }
// if (!globalThis.importMeta.env) {
//   globalThis.importMeta.env = {};
// }

// // Provide the specific envs your components use
// globalThis.importMeta.env.VITE_API_BASE = 'http://localhost:3000';

// // Common jsdom polyfills used by UI libs
// if (typeof window !== 'undefined') {
//   window.matchMedia =
//     window.matchMedia ||
//     function () {
//       return {
//         matches: false,
//         addListener: () => {},
//         removeListener: () => {},
//         addEventListener: () => {},
//         removeEventListener: () => {},
//         dispatchEvent: () => false,
//       };
//     };
// }

// client/jest.setup.cjs
require('@testing-library/jest-dom');

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

try {
  const { webcrypto } = require('crypto');
  if (!global.crypto) global.crypto = webcrypto;
} catch {}

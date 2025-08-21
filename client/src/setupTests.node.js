// Provide WebCrypto in Node for encryption tests
const { webcrypto } = require('crypto');
if (!global.crypto) {
  global.crypto = webcrypto;
}

// If tests use TextEncoder/TextDecoder in Node:
const { TextEncoder, TextDecoder } = require('util');
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

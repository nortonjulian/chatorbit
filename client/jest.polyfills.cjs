'use strict';

/**
 * Global polyfills + shims for Jest (jsdom)
 * Keep this file minimal and deterministic.
 */

// ---- TextEncoder/TextDecoder (Node < 19 in Jest)
if (typeof globalThis.TextEncoder === 'undefined' || typeof globalThis.TextDecoder === 'undefined') {
  try {
    const { TextEncoder, TextDecoder } = require('util');
    if (typeof globalThis.TextEncoder === 'undefined') globalThis.TextEncoder = TextEncoder;
    if (typeof globalThis.TextDecoder === 'undefined') globalThis.TextDecoder = TextDecoder;
  } catch {
    // Fallback no-op enc/dec just to avoid crashes (shouldn't be needed)
    globalThis.TextEncoder = class { encode(s) { return Buffer.from(String(s) || '', 'utf8'); } };
    globalThis.TextDecoder = class { decode(b) { return Buffer.from(b).toString('utf8'); } };
  }
}

// ---- ResizeObserver (Mantine uses it in ScrollArea)
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ---- Blob in Node (if needed for Response shim below)
if (typeof globalThis.Blob === 'undefined') {
  try {
    const { Blob } = require('buffer');
    if (Blob) globalThis.Blob = Blob;
  } catch {}
}

// ---- Minimal Response shim
// Supports new Response(blob).text() and a few other shapes.
if (!globalThis.Response) {
  globalThis.Response = class Response {
    constructor(body) {
      this._body = body;
    }

    async text() {
      const b = this._body;
      if (b == null) return '';

      // --- Handle real Blobs early and directly (prevents "[object Blob]" surprises)
      if (typeof globalThis.Blob !== 'undefined' && b instanceof globalThis.Blob) {
        if (typeof b.text === 'function') {
          try { return await b.text(); } catch {}
        }
        if (typeof b.arrayBuffer === 'function') {
          try {
            const ab = await b.arrayBuffer();
            return Buffer.from(ab).toString('utf8');
          } catch {}
        }
      }

      // 1) If it's a Blob-like object, force-call Blob.prototype.text/arrayBuffer
      const BlobCtor = globalThis.Blob || (function () {
        try { return require('buffer').Blob; } catch { return undefined; }
      })();

      const isBlobLike =
        !!b &&
        (
          (typeof b.arrayBuffer === 'function' && typeof b.slice === 'function') ||
          (typeof b.size === 'number' && typeof b.type === 'string') ||
          (b && b[Symbol.toStringTag] === 'Blob')
        );

      if (BlobCtor && isBlobLike) {
        const proto = BlobCtor.prototype;
        if (proto && typeof proto.text === 'function') {
          try { return await proto.text.call(b); } catch {}
        }
        if (typeof b.arrayBuffer === 'function') {
          try {
            const ab = await b.arrayBuffer();
            return Buffer.from(ab).toString('utf8');
          } catch {}
        }
      }

      // 2) If it already exposes .text() (e.g., undici Response/Body, File), use it
      if (typeof b?.text === 'function') {
        try { return await b.text(); } catch {}
      }

      // 3) ArrayBuffer / Buffer-like
      if (typeof b?.arrayBuffer === 'function') {
        try {
          const ab = await b.arrayBuffer();
          return Buffer.from(ab).toString('utf8');
        } catch {}
      }
      if (typeof ArrayBuffer !== 'undefined' && b instanceof ArrayBuffer) {
        return Buffer.from(b).toString('utf8');
      }
      if (Buffer.isBuffer?.(b)) {
        return b.toString('utf8');
      }

      // 4) Readable stream with .getReader() or .stream()
      try {
        if (typeof b?.getReader === 'function') {
          const reader = b.getReader();
          const chunks = [];
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          return Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8');
        }
        if (typeof b?.stream === 'function') {
          // Node streams: use consumers.text if available
          try {
            const { text: consumeText } = require('node:stream/consumers');
            return await consumeText(b.stream());
          } catch {}
        }
      } catch {}

      // 5) String
      if (typeof b === 'string') return b;

      // 6) Last resort
      return String(b);
    }

    async json() {
      const t = await this.text();
      return JSON.parse(t);
    }
  };
}

// ---- Optional: matchMedia stub (quiet Mantine/usehooks warnings if any)
if (typeof globalThis.matchMedia === 'undefined') {
  globalThis.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false; },
  });
}

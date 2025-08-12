import nacl from 'tweetnacl';
import * as util from 'tweetnacl-util';

export const b64ToBytes = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
export const bytesToB64 = (bytes) => btoa(String.fromCharCode(...bytes));

// NOTE: For MVP we model the shared key as HKDF(secret || sPub || ePub) to avoid curve ops in browser for now.
// If you want proper ECDH in the browser, switch to nacl.box.keyPair for curve25519 and use scalarMult.
// Here we keep it simple and aligned with server "secret" + sPub exchange.
export function hkdfSha256(keyMaterialUint8, info = 'provision-v1', len = 32) {
  // Lightweight HKDF using Web Crypto
  return window.crypto.subtle.importKey('raw', keyMaterialUint8, {name: 'HKDF'}, false, ['deriveBits'])
    .then(key => window.crypto.subtle.deriveBits({name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode(info)}, key, len * 8))
    .then(buf => new Uint8Array(buf));
}

export async function deriveSharedKeyBrowser(secretB64, sPubB64, ePubB64) {
  const secret = b64ToBytes(secretB64);
  const sPub = b64ToBytes(sPubB64 || '');
  const ePub = b64ToBytes(ePubB64 || '');
  const concat = new Uint8Array(secret.length + sPub.length + ePub.length);
  concat.set(secret, 0);
  concat.set(sPub, secret.length);
  concat.set(ePub, secret.length + sPub.length);
  return hkdfSha256(concat, 'provision-v1', 32); // Uint8Array length 32
}

export function sealWithKey(kUint8, jsonObj) {
  const nonce = nacl.randomBytes(24);
  const msg = util.decodeUTF8(JSON.stringify(jsonObj));
  const ct = nacl.secretbox(msg, nonce, kUint8);
  return { nonceB64: bytesToB64(nonce), ciphertextB64: bytesToB64(ct) };
}

export function openWithKey(kUint8, nonceB64, ctB64) {
  const nonce = b64ToBytes(nonceB64);
  const ct = b64ToBytes(ctB64);
  const msg = nacl.secretbox.open(ct, nonce, kUint8);
  if (!msg) throw new Error('Decryption failed');
  return JSON.parse(util.encodeUTF8(msg));
}

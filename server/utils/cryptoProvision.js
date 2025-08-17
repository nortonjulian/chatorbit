import nacl from 'tweetnacl';
import * as util from 'tweetnacl-util';
import crypto from 'crypto';

export function randomBytes(n = 32) {
  return crypto.randomBytes(n);
}
export function toB64(buf) {
  return Buffer.from(buf).toString('base64');
}
export function fromB64(b64) {
  return Buffer.from(b64, 'base64');
}

export function hkdf(keyMaterial, info = 'provision-v1', len = 32) {
  return crypto.hkdfSync(
    'sha256',
    Buffer.alloc(0),
    Buffer.from(keyMaterial),
    Buffer.from(info),
    len
  );
}

export function deriveSharedKey(ePriv_b64, otherPub_b64, secret_b64) {
  const ePriv = fromB64(ePriv_b64);
  const otherPub = fromB64(otherPub_b64);
  const shared = nacl.scalarMult(
    ePriv, // 32 bytes
    otherPub // 32 bytes
  );
  const combined = Buffer.concat([Buffer.from(shared), fromB64(secret_b64)]);
  return hkdf(combined, 'provision-v1', 32); // Uint8Array
}

export function seal(k, jsonObj) {
  const nonce = nacl.randomBytes(24);
  const msg = util.decodeUTF8(JSON.stringify(jsonObj));
  const ct = nacl.secretbox(msg, nonce, k);
  return { nonce: toB64(nonce), ciphertext: toB64(ct) };
}

export function open(k, nonce_b64, ct_b64) {
  const nonce = fromB64(nonce_b64);
  const ct = fromB64(ct_b64);
  const msg = nacl.secretbox.open(ct, nonce, k);
  if (!msg) throw new Error('Decryption failed');
  return JSON.parse(util.encodeUTF8(msg));
}

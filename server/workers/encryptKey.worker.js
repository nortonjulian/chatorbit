import { parentPort, workerData } from 'node:worker_threads';
import nacl from 'tweetnacl';
import { decode as b64d, encode as b64e } from '../utils/b64.js';

/**
 * workerData: { msgKeyB64, recipientPubB64 }
 * - msgKeyB64: base64 of the symmetric message key (e.g., 32 bytes)
 * - recipientPubB64: base64 of recipient's Curve25519 public key (32 bytes)
 *
 * Returns: { ok:true, recipientPubB64, sealedKeyB64 } OR { ok:false, err }
 */
function sealKey({ msgKeyB64, recipientPubB64 }) {
  // libsodium/tweetnacl “sealed box” isn’t in plain tweetnacl; emulate with ephemeral key.
  // Scheme: use nacl.box with ephemeral keypair → recipient pubkey.
  // Payload = msgKey, Nonce = 24 bytes random.
  const recipientPub = b64d(recipientPubB64); // Uint8Array(32)
  const msgKey = b64d(msgKeyB64); // Uint8Array(32)

  const eph = nacl.box.keyPair();
  const nonce = nacl.randomBytes(24);

  const boxed = nacl.box(msgKey, nonce, recipientPub, eph.secretKey);

  // Package: ephPub || nonce || boxed
  const payload = new Uint8Array(
    eph.publicKey.length + nonce.length + boxed.length
  );
  payload.set(eph.publicKey, 0);
  payload.set(nonce, eph.publicKey.length);
  payload.set(boxed, eph.publicKey.length + nonce.length);

  return {
    ok: true,
    recipientPubB64,
    sealedKeyB64: b64e(payload),
  };
}

try {
  const out = sealKey(workerData);
  parentPort.postMessage(out);
} catch (err) {
  parentPort.postMessage({ ok: false, err: String(err) });
}

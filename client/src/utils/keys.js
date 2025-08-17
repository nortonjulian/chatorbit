import nacl from 'tweetnacl';
import * as util from 'tweetnacl-util';
import { saveKeysIDB, loadKeysIDB, clearKeysIDB } from './keyStore';

export function generateKeypair() {
  const kp = nacl.box.keyPair();
  return {
    publicKey: util.encodeBase64(kp.publicKey),
    privateKey: util.encodeBase64(kp.secretKey),
  };
}

// same signatures as before, but async now (IndexedDB)
export async function saveKeysLocal({ publicKey, privateKey }) {
  await saveKeysIDB({ publicKey, privateKey });
}

export async function loadKeysLocal() {
  return await loadKeysIDB();
}

export async function clearKeysLocal() {
  await clearKeysIDB();
}

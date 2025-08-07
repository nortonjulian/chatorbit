import crypto from 'crypto';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

export async function encryptMessageForParticipants(message, sender, recipients) {
    const sessionKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey, iv);
    const encrypted = Buffer.concat([cipher.update(message, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag();
    const ciphertext = Buffer.concat([iv, tag, encrypted]).toString('base64')

    const encryptedKeys = {};
    const senderSecret = naclUtil.decodeBase64(sender.privateKey);
    const senderPublic = naclUtil.decodeBase64(sender.publiceKey);

    // Encrypt for recipients
  for (const recipient of recipients) {
    const nonce = crypto.randomBytes(24);
    const recipientPublic = naclUtil.decodeBase64(recipient.publicKey);
    const encryptedKey = nacl.box(sessionKey, nonce, recipientPublic, senderSecret);
    encryptedKeys[recipient.id] = naclUtil.encodeBase64(Buffer.concat([nonce, Buffer.from(encryptedKey)]));
  }

   // Encrypt for sender (for reporting/re-download)
    const senderNonce = crypto.randomBytes(24);
    const encryptedKeyForSender = nacl.box(sessionKey, senderNonce, senderPublic, senderSecret);
    encryptedKeys[sender.id] = naclUtil.encodeBase64(Buffer.concat([senderNonce, Buffer.from(encryptedKeyForSender)]));

  return { ciphertext, encryptedKeys };
}

export async function decryptMessageForUser(ciphertext, encryptedSessionKey, currentUserPrivateKey, currentUserPublicKey, senderPublicKey) {
    const keyBuffer = naclUtil.decodeBase64(encryptedSessionKey);
    const nonce = keyBuffer.slice(0, 24);
    const boxData = keyBuffer.slice(24);

    const sharedKey = nacl.box.open(
        boxData,
        nonce,
        naclUtil.decodeBase64(senderPublicKey),
        naclUtil.decodeBase64(currentUserPrivateKey)
    )

    if (!sharedKey) throw new Error('Unable to decrypt session key');

    const [iv, tag, encrypted] = [
        Buffer.from(ciphertext, 'base64').slice(0, 12),
        Buffer.from(ciphertext, 'base64').slice(12, 28),
        Buffer.from(ciphertext, 'base64').slice(28)
    ]
        
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(sharedKey), iv)
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return decrypted.toString('utf8')
}

export function generateKeyPair() {
  const keyPair = nacl.box.keyPair();

  return {
    publicKey: naclUtil.encodeBase64(keyPair.publicKey),
    privateKey: naclUtil.encodeBase64(keyPair.secretKey),
  };
}

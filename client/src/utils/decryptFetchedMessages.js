import { decryptMessageForUserBrowser } from './decryptionClient.js';

/**
 * Decrypts an array of messages for the current user.
 */
export async function decryptFetchedMessages(
  messages,
  currentUserPrivateKey,
  senderPublicKeys,
  currentUserId
) {
  return Promise.all(
    messages.map(async (msg) => {
      try {
        const encryptedKey = msg.encryptedKeys?.[currentUserId];
        const senderPublicKey = senderPublicKeys?.[msg.sender?.id];

        if (!encryptedKey || !senderPublicKey) {
          throw new Error('Missing encrypted key or sender public key');
        }

        const decrypted = await decryptMessageForUserBrowser(
          msg.contentCiphertext,
          encryptedKey,
          currentUserPrivateKey,
          senderPublicKey
        );

        return { ...msg, decryptedContent: decrypted };
      } catch (err) {
        console.warn(`Decryption failed for message ${msg.id}:`, err);
        return { ...msg, decryptedContent: '[Encrypted message]' };
      }
    })
  );
}

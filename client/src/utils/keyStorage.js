import { openDB } from 'idb';

const DB_NAME = 'ChatOrbitKeys';
const STORE_NAME = 'keys';

/**
 * Saves the private key for a user.
 */
export async function savePrivateKey(userId, privateKey) {
  try {
    const db = await openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
    await db.put(STORE_NAME, privateKey, `user-${userId}`);
  } catch {
    console.log('IndexedDB not available, falling back to localStorage.');
    localStorage.setItem(`chatorbit-privatekey-${userId}`, privateKey);
  }
}

/**
 * Loads the private key for a user.
 */
export async function loadPrivateKey(userId) {
  try {
    const db = await openDB(DB_NAME, 1);
    return (await db.get(STORE_NAME, `user-${userId}`)) || null;
  } catch {
    console.log('Failed to load from IndexedDB, falling back to localStorage.');
    return localStorage.getItem(`chatorbit-privatekey-${userId}`) || null;
  }
}

/**
 * Removes the private key for a user (on logout).
 */
export async function clearPrivateKey(userId) {
  try {
    const db = await openDB(DB_NAME, 1);
    await db.delete(STORE_NAME, `user-${userId}`);
  } catch {
    console.log('IndexedDB not available, falling back to localStorage.');
    localStorage.removeItem(`chatorbit-privatekey-${userId}`);
  }
}

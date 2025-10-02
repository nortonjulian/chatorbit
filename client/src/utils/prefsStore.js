import { openDB } from 'idb';

const DB_NAME = 'chatforia';
const STORE = 'prefs';

const dbp = openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE)) {
      db.createObjectStore(STORE);
    }
  },
});

export async function getPref(key, defaultValue) {
  try {
    const db = await dbp;
    const v = await db.get(STORE, key);
    return v ?? defaultValue;
  } catch (e) {
    console.warn('getPref failed', e);
    return defaultValue;
  }
}

export async function setPref(key, value) {
  try {
    const db = await dbp;
    await db.put(STORE, value, key);
  } catch (e) {
    console.warn('setPref failed', e);
  }
}

// keys
export const PREF_SMART_REPLIES = 'smartReplies';

const DB_NAME = 'chat-orbit';
const STORE = 'keys';
const VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function get(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function del(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Public API (mirrors your previous localStorage helpers)
export async function saveKeysIDB({ publicKey, privateKey }) {
  if (publicKey) await put('co_pub', publicKey);
  if (privateKey) await put('co_priv', privateKey);
}

export async function loadKeysIDB() {
  const [publicKey, privateKey] = await Promise.all([
    get('co_pub'),
    get('co_priv'),
  ]);
  return { publicKey, privateKey };
}

export async function clearKeysIDB() {
  await Promise.all([del('co_pub'), del('co_priv')]);
}

// One-time migration from localStorage → IndexedDB
export async function migrateLocalToIDBIfNeeded() {
  const lsPub = localStorage.getItem('co_pub');
  const lsPriv = localStorage.getItem('co_priv');
  if (!lsPub && !lsPriv) return false;

  await saveKeysIDB({
    publicKey: lsPub || undefined,
    privateKey: lsPriv || undefined,
  });
  localStorage.removeItem('co_pub');
  localStorage.removeItem('co_priv');
  return true;
}

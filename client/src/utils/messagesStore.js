const DB_NAME = 'chatorbit';
const STORE = 'room_msgs';

let _db;
function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'key' }); // key: `${roomId}`
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

async function _getConn(mode = 'readonly') {
  const db = await openDB();
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function addMessages(roomId, msgs) {
  const os = await _getConn('readwrite');
  const key = String(roomId);
  const existing = await getRoomMessages(roomId);
  const map = new Map((existing || []).map(m => [m.id, m]));
  for (const m of msgs) map.set(m.id, m);
  return new Promise((resolve, reject) => {
    const req = os.put({ key, messages: Array.from(map.values()) });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getRoomMessages(roomId) {
  const os = await _getConn('readonly');
  const key = String(roomId);
  return new Promise((resolve) => {
    const req = os.get(key);
    req.onsuccess = () => resolve(req.result?.messages || []);
    req.onerror = () => resolve([]); // fail-soft
  });
}

export async function searchRoom(roomId, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const all = await getRoomMessages(roomId);
  return all.filter(m => {
    const t1 = (m.decryptedContent || m.translatedForMe || '').toLowerCase();
    const t2 = (m.rawContent || '').toLowerCase();
    return t1.includes(q) || t2.includes(q);
  });
}

export async function getMediaInRoom(roomId) {
  const all = await getRoomMessages(roomId);
  return all.filter(m => !!m.imageUrl); // adapt if you store videos/files differently
}

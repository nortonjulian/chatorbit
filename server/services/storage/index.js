import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Local disk adapter (default for dev/test)
const UPLOAD_DIR = process.env.UPLOAD_ROOT || path.join(__dirname, '../../uploads');

// Ensure uploads folder exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Save a file buffer to a given key (subpath).
 * Compatible with routes/uploads.js which passes { buf, key, contentType }.
 */
export async function storeBuffer({ buf, key /*, contentType*/ }) {
  const filepath = path.join(UPLOAD_DIR, key);
  await fs.promises.mkdir(path.dirname(filepath), { recursive: true });
  // write-once (dedupe if already present)
  try {
    await fs.promises.writeFile(filepath, buf, { flag: 'wx' });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  return { ok: true, location: filepath };
}

/**
 * Basic save by simple filename (legacy usage).
 */
export async function saveFile(buffer, filename) {
  const filepath = path.join(UPLOAD_DIR, filename);
  await fs.promises.mkdir(path.dirname(filepath), { recursive: true });
  await fs.promises.writeFile(filepath, buffer);
  return filepath;
}

/**
 * Get a readable stream for a saved file by filename (legacy).
 */
export function getFileStream(filename) {
  const filepath = path.join(UPLOAD_DIR, filename);
  return fs.createReadStream(filepath);
}

/**
 * Delete a file from disk by filename (legacy).
 */
export async function deleteFile(filename) {
  const filepath = path.join(UPLOAD_DIR, filename);
  await fs.promises.unlink(filepath).catch(() => {});
}

export default {
  storeBuffer,
  saveFile,
  getFileStream,
  deleteFile,
};

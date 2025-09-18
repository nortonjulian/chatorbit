// server/services/storage/localStorage.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = process.env.UPLOAD_ROOT || path.resolve(__dirname, '../../..', 'uploads'); // project/uploads

await fs.mkdir(UPLOAD_ROOT, { recursive: true });

export async function storeBuffer({ buf, key }) {
  const abs = path.join(UPLOAD_ROOT, key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buf, { flag: 'wx' }).catch(async (e) => {
    // if file exists (dedupe by hash), ignore write
    if (e.code !== 'EEXIST') throw e;
  });
  return { ok: true, location: abs };
}

export async function readStream({ key, createReadStream }) {
  // For local, we’ll defer to createReadStream in route (fs.createReadStream(keyAbs))
  return { ok: true };
}

export function keyToAbsolute(key) {
  return path.join(UPLOAD_ROOT, key);
}

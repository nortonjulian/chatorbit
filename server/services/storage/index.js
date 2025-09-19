import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Local disk adapter (default for dev)
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads folder exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Save a file buffer to local disk.
 * @param {Buffer} buffer - file data
 * @param {string} filename - target filename
 * @returns {string} saved filepath
 */
export async function saveFile(buffer, filename) {
  const filepath = path.join(UPLOAD_DIR, filename);
  await fs.promises.writeFile(filepath, buffer);
  return filepath;
}

/**
 * Get a readable stream for a saved file.
 * @param {string} filename - saved filename
 * @returns {fs.ReadStream}
 */
export function getFileStream(filename) {
  const filepath = path.join(UPLOAD_DIR, filename);
  return fs.createReadStream(filepath);
}

/**
 * Delete a file from disk.
 * @param {string} filename - saved filename
 */
export async function deleteFile(filename) {
  const filepath = path.join(UPLOAD_DIR, filename);
  await fs.promises.unlink(filepath).catch(() => {});
}

export default {
  saveFile,
  getFileStream,
  deleteFile,
};

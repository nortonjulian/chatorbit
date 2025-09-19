import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { uploadDirs } from '../middleware/uploads.js';

const THUMBS_DIR = path.join(uploadDirs.ROOT, 'thumbs');
fs.mkdirSync(THUMBS_DIR, { recursive: true });

export async function ensureThumb(absSource, relName) {
  const outName = relName + '.thumb.jpg';
  const outPath = path.join(THUMBS_DIR, outName);

  try {
    await fs.promises.access(outPath);
    return { rel: path.join('thumbs', outName), abs: outPath };
  } catch {}

  // generate ~ 512px max dimension
  await sharp(absSource)
    .rotate()
    .resize(512, 512, { fit: 'inside' })
    .jpeg({ quality: 76 })
    .toFile(outPath);
  return { rel: path.join('thumbs', outName), abs: outPath };
}

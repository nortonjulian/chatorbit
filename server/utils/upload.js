import multer from 'multer';
import path from 'path';
import fs from 'fs';

const ROOT = process.env.UPLOADS_DIR || path.resolve('uploads'); // private root
const AVATARS_DIR = path.join(ROOT, 'avatars');
const MEDIA_DIR   = path.join(ROOT, 'media');

for (const p of [ROOT, AVATARS_DIR, MEDIA_DIR]) {
  fs.mkdirSync(p, { recursive: true });
}

// --- Allowlist (trim to what you truly need) ---
const IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const AUDIO = ['audio/mpeg', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4'];
const VIDEO = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
const DOCS  = ['application/pdf', 'text/plain'];
const ALLOWED = new Set([...IMAGE, ...AUDIO, ...VIDEO, ...DOCS]);

// Extra belt-and-suspenders: block these extensions even if MIME claims OK
const DISALLOWED_EXT = new Set(['.svg', '.html', '.htm', '.xhtml', '.shtml', '.xml']);

// Reusable storage maker
function storageFor(dest) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const safeBase = (file.originalname || 'file').replace(/[^\w.\-]+/g, '_').slice(0, 80);
      const ts = Date.now();
      cb(null, `${ts}_${Math.random().toString(36).slice(2)}_${safeBase}`);
    },
  });
}

export function makeUploader({ maxFiles = 10, maxBytes = 15 * 1024 * 1024, kind = 'media' } = {}) {
  const dest = kind === 'avatar' ? AVATARS_DIR : MEDIA_DIR;

  const fileFilter = (_req, file, cb) => {
    const mimeOk = ALLOWED.has(file.mimetype);
    const ext = path.extname(file.originalname || '').toLowerCase();
    const extOk = !DISALLOWED_EXT.has(ext);
    if (!mimeOk || !extOk) return cb(new Error('Unsupported file type'));
    cb(null, true);
  };

  return multer({
    storage: storageFor(dest),
    limits: { fileSize: maxBytes, files: maxFiles },
    fileFilter,
  });
}

export const uploadDirs = { ROOT, AVATARS_DIR, MEDIA_DIR };

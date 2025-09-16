import multer from 'multer';
import path from 'path';
import fs from 'fs';

const ROOT = process.env.UPLOADS_DIR || path.resolve('uploads'); // private root for local/disk
const AVATARS_DIR = path.join(ROOT, 'avatars');
const MEDIA_DIR   = path.join(ROOT, 'media');

// Ensure local dirs exist if we use disk storage
for (const p of [ROOT, AVATARS_DIR, MEDIA_DIR]) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

// ---- MIME allowlist (trim as needed) ----
const IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const AUDIO = ['audio/mpeg', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4'];
const VIDEO = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
const DOCS  = ['application/pdf', 'text/plain'];
const ALLOWED = new Set([...IMAGE, ...AUDIO, ...VIDEO, ...DOCS]);

// Disallow dangerous extensions even if MIME claims OK
const DISALLOWED_EXT = new Set(['.svg', '.html', '.htm', '.xhtml', '.shtml', '.xml']);

// Choose storage: `memory` is best for cloud (R2/S3) + image processing; `disk` for local FS
const TARGET = (process.env.UPLOAD_TARGET || 'memory').toLowerCase(); // 'memory' | 'local' | 'disk'
const useMemory = TARGET === 'memory';

// Disk storage generator (separate destination per kind)
function diskStorageFor(destDir) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destDir),
    filename: (_req, file, cb) => {
      const safeBase = (file.originalname || 'file').replace(/[^\w.\-]+/g, '_').slice(0, 80);
      cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}_${safeBase}`);
    },
  });
}

function makeFileFilter({ imagesOnly = false } = {}) {
  return (_req, file, cb) => {
    const ct = (file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase();

    const mimeOk = ALLOWED.has(ct);
    if (!mimeOk) return cb(new Error('UNSUPPORTED_FILE_TYPE'), false);

    if (DISALLOWED_EXT.has(ext)) return cb(new Error('UNSUPPORTED_FILE_TYPE'), false);

    if (imagesOnly && !ct.startsWith('image/')) {
      return cb(new Error('IMAGE_ONLY'), false);
    }

    // If it claims to be an image, ensure extension matches common image types
    if (ct.startsWith('image/') && !['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
      return cb(new Error('INVALID_IMAGE_EXTENSION'), false);
    }

    cb(null, true);
  };
}

function makeUploader({ kind = 'media', maxFiles = 10, maxBytes = 15 * 1024 * 1024, imagesOnly = false } = {}) {
  const fileFilter = makeFileFilter({ imagesOnly });

  // choose per-kind disk destination if using disk
  const diskDest = kind === 'avatar' ? AVATARS_DIR : MEDIA_DIR;

  const storage = useMemory
    ? multer.memoryStorage()
    : diskStorageFor(diskDest);

  return multer({
    storage,
    fileFilter,
    limits: { files: maxFiles, fileSize: maxBytes },
  });
}

// Export ready-to-use middlewares
export const uploadAvatar = makeUploader({ kind: 'avatar', maxFiles: 1, maxBytes: 5 * 1024 * 1024, imagesOnly: true });
export const uploadMedia  = makeUploader({ kind: 'media',  maxFiles: 10, maxBytes: 100 * 1024 * 1024 });

export const uploadDirs = { ROOT, AVATARS_DIR, MEDIA_DIR, TARGET };

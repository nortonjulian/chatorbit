import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'node:crypto';

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

/** One-off single-file uploader in memory (good for dedup + external storage pipes) */
export const singleUploadMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter: makeFileFilter({ imagesOnly: false }),
  limits: { files: 1, fileSize: 15 * 1024 * 1024 }, // 15MB default; tune as needed
}).single('file');

/** SHA-256 of a Buffer (for dedup keys) */
export function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** Suggest a safe filename based on original name + known extension policy */
export function buildSafeName(mime, originalName) {
  // map common mimes to preferred extensions; fall back to original ext if it’s safe
  const preferredExt = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'audio/mpeg': 'mp3',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'video/quicktime': 'mov',
  }[mime];

  const orig = String(originalName || '');
  const baseOnly = orig.split('/').pop().split('\\').pop();
  const safeBase = baseOnly.replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'file';

  let ext = preferredExt;
  if (!ext) {
    // if we don't have a preferred ext, keep the original if it’s not in DISALLOWED_EXT
    const origExt = path.extname(baseOnly || '').toLowerCase();
    ext = DISALLOWED_EXT.has(origExt) ? 'bin' : (origExt.replace('.', '') || 'bin');
  }

  // ensure we don’t end up with double extensions
  const baseNoExt = safeBase.replace(/\.[A-Za-z0-9]{1,5}$/, '');
  return { ext, suggested: `${baseNoExt}.${ext}` };
}

// Export ready-to-use middlewares
export const uploadAvatar = makeUploader({ kind: 'avatar', maxFiles: 1, maxBytes: 5 * 1024 * 1024, imagesOnly: true });
export const uploadMedia  = makeUploader({ kind: 'media',  maxFiles: 10, maxBytes: 100 * 1024 * 1024 });

export const uploadDirs = { ROOT, AVATARS_DIR, MEDIA_DIR, TARGET };

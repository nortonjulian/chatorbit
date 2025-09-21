import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
export const UPLOAD_ROOT =
  process.env.UPLOAD_DIR || path.resolve(ROOT, 'tmp_uploads');

// Common subdirs used by routes/tests
export const uploadDirs = {
  ROOT: UPLOAD_ROOT,
  AVATARS_DIR: path.join(UPLOAD_ROOT, 'avatars'),
  MEDIA_DIR: path.join(UPLOAD_ROOT, 'media'),
};

/** Ensure the (sub)directory under the upload root exists and return its absolute path. */
export async function ensureUploadDir(subdir = '') {
  const dir = path.resolve(UPLOAD_ROOT, subdir);
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

/** Sanitize a filename to a safe subset. */
export function makeSafeFilename(name = '') {
  const base = String(name || '').replace(/[^a-zA-Z0-9._-]+/g, '_');
  return base.length ? base : `file_${Date.now()}`;
}

/** Get absolute disk path for a relative path under the upload root. */
export function diskPathFor(relativePath) {
  return path.resolve(UPLOAD_ROOT, relativePath);
}

/** Build a public URL (test/dev-friendly). */
export function getPublicUrl(relativePath) {
  const rel = String(relativePath).replace(/^[./]+/, '').replace(/\\/g, '/');
  // In production you might replace this with your CDN/origin host.
  return `/uploads/${rel}`;
}

/**
 * Save a Buffer to disk under the upload root.
 * Returns: { relativePath, absolutePath, size, url }
 */
export async function saveBuffer(buffer, { filename, subdir = '' } = {}) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('buffer must be a Buffer');
  }

  const dir = await ensureUploadDir(subdir);
  const ext = path.extname(filename || '') || '';
  const safeBase = makeSafeFilename(path.basename(filename || '', ext));
  const rand = crypto.randomBytes(6).toString('hex');

  const fileName = `${safeBase}-${rand}${ext}`;
  const rel = path.join(subdir, fileName).replace(/\\/g, '/');
  const abs = path.join(dir, fileName);

  await fsp.writeFile(abs, buffer);
  const stat = await fsp.stat(abs);

  return {
    relativePath: rel,
    absolutePath: abs,
    size: stat.size,
    url: getPublicUrl(rel),
  };
}

/**
 * Save a Readable stream to disk under the upload root.
 * Returns: { relativePath, absolutePath, size, url }
 */
export async function saveStream(readable, { filename, subdir = '' } = {}) {
  const dir = await ensureUploadDir(subdir);
  const ext = path.extname(filename || '') || '';
  const safeBase = makeSafeFilename(path.basename(filename || '', ext));
  const rand = crypto.randomBytes(6).toString('hex');

  const fileName = `${safeBase}-${rand}${ext}`;
  const rel = path.join(subdir, fileName).replace(/\\/g, '/');
  const abs = path.join(dir, fileName);

  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(abs);
    readable.on('error', reject);
    ws.on('error', reject);
    ws.on('finish', resolve);
    readable.pipe(ws);
  });

  const stat = await fsp.stat(abs);

  return {
    relativePath: rel,
    absolutePath: abs,
    size: stat.size,
    url: getPublicUrl(rel),
  };
}

/** Delete a file by relativePath; silently succeeds if it doesn't exist. */
export async function deleteFile(relativePath) {
  const abs = diskPathFor(relativePath);
  try {
    await fsp.unlink(abs);
  } catch (e) {
    if (e && e.code === 'ENOENT') return; // already gone
    throw e;
  }
}

/** Test helper to wipe and recreate the upload root. */
export async function __resetUploads() {
  // Ensure base exists, then remove and recreate for a clean slate
  await ensureUploadDir();
  try {
    await fsp.rm(UPLOAD_ROOT, { recursive: true, force: true });
  } catch {}
  await ensureUploadDir();
}

/**
 * Factory to create a scoped uploader with custom root/prefix/subdir and limits.
 * Returns an object with:
 *   - limits: { fileSize, files }  (present for tests that check it)
 *   - saveBuffer, saveStream, deleteFile, diskPathFor, publicUrl, ensureDir, safeName
 *
 * Options supported by tests:
 *   - kind: 'avatar' | 'media' | (custom)  → picks a default subdir
 *   - maxFiles: number → sets limits.files
 *   - maxBytes: number → sets limits.fileSize
 *
 * Additional options (still supported):
 *   - rootDir, urlPrefix, subdir
 */
export function makeUploader(opts = {}) {
  // Map "kind" to a default subdir
  const kind = String(opts.kind || '').toLowerCase();
  const kindSubdir =
    kind === 'avatar' ? 'avatars'
    : kind === 'media' ? 'media'
    : '';

  const ROOT_DIR = opts.rootDir || UPLOAD_ROOT;
  const URL_PREFIX = (opts.urlPrefix || '/uploads').replace(/\/+$/, '');
  // Explicit subdir overrides kindSubdir if provided
  const FIXED_SUBDIR = (opts.subdir || kindSubdir || '').replace(/^\/+|\/+$/g, '');

  const limits = {
    ...(Number.isFinite(opts.maxBytes) ? { fileSize: Number(opts.maxBytes) } : {}),
    ...(Number.isFinite(opts.maxFiles) ? { files: Number(opts.maxFiles) } : {}),
  };

  async function ensureDir(sub = '') {
    const dir = path.resolve(ROOT_DIR, FIXED_SUBDIR, sub);
    await fsp.mkdir(dir, { recursive: true });
    return dir;
  }

  function safeName(name = '') {
    const base = String(name || '').replace(/[^a-zA-Z0-9._-]+/g, '_');
    return base.length ? base : `file_${Date.now()}`;
  }

  function scopedDiskPathFor(rel) {
    return path.resolve(ROOT_DIR, rel);
  }

  function publicUrl(rel) {
    const clean = String(rel).replace(/^[./]+/, '').replace(/\\/g, '/');
    return `${URL_PREFIX}/${clean}`;
  }

  async function scopedSaveBuffer(buf, { filename, subdir = '' } = {}) {
    if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer');
    const dir = await ensureDir(subdir);
    const ext = path.extname(filename || '') || '';
    const base = safeName(path.basename(filename || '', ext));
    const rand = crypto.randomBytes(6).toString('hex');

    const fileName = `${base}-${rand}${ext}`;
    const rel = path.join(FIXED_SUBDIR, subdir, fileName).replace(/\\/g, '/');
    const abs = path.join(dir, fileName);

    await fsp.writeFile(abs, buf);
    const stat = await fsp.stat(abs);
    return { relativePath: rel, absolutePath: abs, size: stat.size, url: publicUrl(rel) };
  }

  async function scopedSaveStream(readable, { filename, subdir = '' } = {}) {
    const dir = await ensureDir(subdir);
    const ext = path.extname(filename || '') || '';
    const base = safeName(path.basename(filename || '', ext));
    const rand = crypto.randomBytes(6).toString('hex');

    const fileName = `${base}-${rand}${ext}`;
    const rel = path.join(FIXED_SUBDIR, subdir, fileName).replace(/\\/g, '/');
    const abs = path.join(dir, fileName);

    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(abs);
      readable.on('error', reject);
      ws.on('error', reject);
      ws.on('finish', resolve);
      readable.pipe(ws);
    });

    const stat = await fsp.stat(abs);
    return { relativePath: rel, absolutePath: abs, size: stat.size, url: publicUrl(rel) };
  }

  async function scopedDeleteFile(rel) {
    const abs = scopedDiskPathFor(rel);
    try { await fsp.unlink(abs); } catch (e) { if (e?.code !== 'ENOENT') throw e; }
  }

  // Return a plain object (not the actual Multer instance) — tests only check `.limits` optionally.
  return {
    limits, // presence allows tests to assert configured limits
    rootDir: ROOT_DIR,
    urlPrefix: URL_PREFIX,
    ensureDir,
    safeName,
    diskPathFor: scopedDiskPathFor,
    publicUrl,
    saveBuffer: scopedSaveBuffer,
    saveStream: scopedSaveStream,
    deleteFile: scopedDeleteFile,
  };
}

/** Default export: convenience namespace */
const uploader = {
  UPLOAD_ROOT,
  uploadDirs,
  ensureUploadDir,
  makeSafeFilename,
  diskPathFor,
  getPublicUrl,
  saveBuffer,
  saveStream,
  deleteFile,
  __resetUploads,
  makeUploader,
};

export default uploader;

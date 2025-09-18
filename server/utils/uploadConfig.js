export const STORAGE_DRIVER = (process.env.STORAGE_DRIVER || 'local').toLowerCase(); // 'local' | 's3'

/** Max file sizes (bytes) */
export const MAX_FILE_SIZE_BYTES = Number(process.env.MAX_FILE_SIZE_BYTES || 10 * 1024 * 1024); // 10MB default

/** Allowed MIME types (tight allowlist) */
export const ALLOWED_MIME = new Set([
  // images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // docs
  'application/pdf',
  'text/plain',
  // videos (optional; comment out if you don’t want)
  // 'video/mp4',
]);

/** Map of preferred file extensions by mime (used for sanitized filenames) */
export const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  // 'video/mp4': 'mp4',
};

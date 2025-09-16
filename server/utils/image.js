import sharp from 'sharp';

/**
 * Defaults can be overridden with env vars:
 *   IMAGE_MAX_WIDTH=2048
 *   IMAGE_THUMB_SIZE=512
 */
export const DEFAULT_MAX_WIDTH = Number(process.env.IMAGE_MAX_WIDTH || 2048);
export const DEFAULT_THUMB_SIZE = Number(process.env.IMAGE_THUMB_SIZE || 512);

/**
 * Process a full-size image:
 * - Auto-orients using EXIF, then drops metadata in output (EXIF stripped)
 * - Resizes down to maxWidth (no enlargement)
 * - Keeps original format by default; you can force jpeg/png/webp via options
 *
 * @param {Buffer} buffer - raw image bytes
 * @param {Object} opts
 * @param {number} [opts.maxWidth=DEFAULT_MAX_WIDTH]
 * @param {'original'|'jpeg'|'png'|'webp'} [opts.format='original']
 * @param {number} [opts.quality=82] - applies to jpeg/webp
 * @returns {Promise<Buffer>} processed image buffer
 */
export async function processImage(
  buffer,
  { maxWidth = DEFAULT_MAX_WIDTH, format = 'original', quality = 82 } = {}
) {
  let img = sharp(buffer, { failOn: 'none' }).rotate(); // auto-orient

  img = img.resize({ width: maxWidth, withoutEnlargement: true });

  if (format === 'jpeg') img = img.jpeg({ quality, mozjpeg: true });
  else if (format === 'png') img = img.png({ compressionLevel: 9 });
  else if (format === 'webp') img = img.webp({ quality, effort: 4 });
  // 'original' -> no explicit encoder call; Sharp chooses based on input

  const { data } = await img.toBuffer({ resolveWithObject: true });
  return data;
}

/**
 * Produce a square-ish thumbnail:
 * - Auto-orients
 * - Fit 'inside' to preserve aspect; no enlargement
 * - (Same EXIF strip behavior — output has no metadata)
 *
 * @param {Buffer} buffer
 * @param {Object} opts
 * @param {number} [opts.size=DEFAULT_THUMB_SIZE]
 * @param {'original'|'jpeg'|'png'|'webp'} [opts.format='webp']  // webp by default for thumbs
 * @param {number} [opts.quality=80]
 * @returns {Promise<Buffer>}
 */
export async function thumbnail(
  buffer,
  { size = DEFAULT_THUMB_SIZE, format = 'webp', quality = 80 } = {}
) {
  let img = sharp(buffer, { failOn: 'none' }).rotate();

  img = img.resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true });

  if (format === 'jpeg') img = img.jpeg({ quality, mozjpeg: true });
  else if (format === 'png') img = img.png({ compressionLevel: 9 });
  else if (format === 'webp') img = img.webp({ quality, effort: 4 });

  const { data } = await img.toBuffer({ resolveWithObject: true });
  return data;
}

/**
 * Optional: read dimensions/type without decoding full image
 */
export async function getMetadata(buffer) {
  return sharp(buffer).metadata(); // { width, height, format, orientation, ... }
}

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_S3_ENDPOINT,   // e.g. <accountid>.r2.cloudflarestorage.com
  R2_BUCKET,
} = process.env;

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_S3_ENDPOINT || !R2_BUCKET) {
  console.warn('[R2] Missing env vars – uploads/signing will fail without them.');
}

// Create a single S3-compatible client for R2
export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_S3_ENDPOINT}`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload an object to R2
 */
export async function r2PutObject({ key, body, contentType, acl = 'public-read' }) {
  // R2 ignores ACLs for public buckets/custom domains, safe to include
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType || 'application/octet-stream',
    ACL: acl,
  });
  return r2.send(cmd);
}

/**
 * Generate a signed URL for GET (useful if your bucket is private)
 */
export async function r2PresignGet({ key, expiresSec = 300 }) {
  const cmd = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });
  return getSignedUrl(r2, cmd, { expiresIn: expiresSec }); // default 5 min
}

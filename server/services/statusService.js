import { prisma } from '../utils/prismaClient.js';
import { isExplicit, cleanText } from '../utils/filter.js';
import { translateForTargets } from '../utils/translate.js';
import { encryptMessageForParticipants } from '../utils/encryption.js';

const DEV_FALLBACKS = String(process.env.DEV_FALLBACKS || '').toLowerCase() === 'true';

/**
 * Normalize incoming audience string from API into the Prisma enum value.
 * Accepts: PUBLIC | EVERYONE | FRIENDS | MUTUALS | CUSTOM
 * Stores:  PUBLIC | FRIENDS | MUTUALS | CUSTOM   (EVERYONE maps to PUBLIC)
 */
function normalizeAudience(a) {
  const v = String(a || '').toUpperCase();
  if (v === 'EVERYONE' || v === 'PUBLIC') return 'EVERYONE';
  if (v === 'FRIENDS' || v === 'MUTUALS' || v === 'CUSTOM') return v;
  throw new Error(`Unsupported audience: ${a}`);
}

/**
 * Resolve audience userIds.
 * Modes (API semantics):
 *  - CUSTOM: explicit list (customIds)
 *  - MUTUALS / FRIENDS: users who also have me in their contacts
 *  - CONTACTS: everyone I have added (one-way)
 *
 * NOTE: This determines *who* should receive keys (when not PUBLIC).
 */
export async function getAudienceUserIds({
  authorId,
  mode = 'MUTUALS',
  customIds = [],
}) {
  const m = String(mode || '').toUpperCase();

  if (m === 'CUSTOM') {
    return [...new Set(customIds.map(Number))].filter(Boolean);
  }

  // All of my one-way contacts (your Contact has userId, not contactId)
  const mine = await prisma.contact.findMany({
    where: { ownerId: Number(authorId) },
    select: { userId: true },
  });
  const myContactIds = mine.map((c) => c.userId);
  if (!myContactIds.length) return [];

  if (m === 'MUTUALS' || m === 'FRIENDS') {
    // Mutuals: they also have me in their contacts
    const reciprocals = await prisma.contact.findMany({
      where: { ownerId: { in: myContactIds }, userId: Number(authorId) },
      select: { ownerId: true },
    });
    const mutualSet = new Set(reciprocals.map((r) => r.ownerId));
    return myContactIds.filter((id) => mutualSet.has(id));
  }

  // CONTACTS: everyone I have added (one-way)
  if (m === 'CONTACTS') {
    return myContactIds;
  }

  // Default to MUTUALS semantics if unknown
  const reciprocals = await prisma.contact.findMany({
    where: { ownerId: { in: myContactIds }, userId: Number(authorId) },
    select: { ownerId: true },
  });
  const mutualSet = new Set(reciprocals.map((r) => r.ownerId));
  return myContactIds.filter((id) => mutualSet.has(id));
}

/**
 * Create a status and persist per-user envelope keys.
 * If DEV_FALLBACKS=true, we skip encryption/translation and insert "self" keys.
 */
export async function createStatusService({
  authorId,
  caption = '',
  files = [],            // [{kind,url,mimeType,width?,height?,durationSec?,caption?}]
  audience = 'MUTUALS',  // accepts 'MUTUALS'|'FRIENDS'|'CONTACTS'|'PUBLIC'|'CUSTOM'|'EVERYONE'
  customAudienceIds = [],
  expireSeconds = 24 * 3600,
}) {
  // Normalize to Prisma enum once up-front
  const audienceEnum = normalizeAudience(audience);
  const isPublic = audienceEnum === 'PUBLIC';

  const author = await prisma.user.findUnique({
    where: { id: Number(authorId) },
    select: {
      id: true,
      username: true,
      preferredLanguage: true,
      allowExplicitContent: true,
      publicKey: true,
    },
  });
  if (!author) throw new Error('Author not found');

  // Resolve audience IDs (API semantics). PUBLIC doesn't need explicit target IDs.
  const audienceIds = isPublic
    ? []
    : await getAudienceUserIds({
        authorId: author.id,
        mode: audience, // keep original incoming mode for resolver semantics
        customIds: customAudienceIds,
      });

  // For non-PUBLIC, require some audience
  if (!isPublic && !audienceIds.length) {
    throw new Error('No audience');
  }

  // Collect users needed for crypto/translation
  const allUserIds = isPublic ? [author.id] : [author.id, ...audienceIds];
  const users = await prisma.user.findMany({
    where: { id: { in: allUserIds } },
    select: {
      id: true,
      username: true,
      preferredLanguage: true,
      allowExplicitContent: true,
      publicKey: true,
    },
  });

  // Content policy (explicit)
  const explicit = caption ? isExplicit(caption) : false;
  const anyDisallow = users.some(
    (u) => u.id !== author.id && !u.allowExplicitContent
  );
  const cap = caption
    ? anyDisallow || !author.allowExplicitContent
      ? cleanText(caption)
      : caption
    : '';

  // Translation (skip in dev fallback)
  let translations = null;
  let translatedFrom = author.preferredLanguage || 'en';
  if (cap && !DEV_FALLBACKS) {
    const targetLangs = users
      .filter((u) => u.id !== author.id)
      .map((u) => u.preferredLanguage || 'en');
    const res = await translateForTargets(cap, translatedFrom, targetLangs);
    translations = Object.keys(res.map || {}).length ? res.map : null;
    translatedFrom = res.from || translatedFrom;
  }

  // Encryption (skip in dev fallback)
  let captionCiphertext = null;
  let encryptedKeys = {};
  if (!DEV_FALLBACKS) {
    const { ciphertext, encryptedKeys: keys } = await encryptMessageForParticipants(
      cap || '',
      author,
      users
    );
    captionCiphertext = ciphertext || null;
    encryptedKeys = keys || {};
  }

  const secs = Math.max(5, Math.min(24 * 3600, Number(expireSeconds) || 24 * 3600));
  const expiresAt = new Date(Date.now() + secs * 1000);

  // Create status (use normalized enum for Prisma)
  const saved = await prisma.status.create({
    data: {
      author: { connect: { id: author.id } },
      captionCiphertext,
      encryptedKeys: Object.keys(encryptedKeys).length ? encryptedKeys : null,
      translations,
      translatedFrom,
      isExplicit: explicit,
      audience: audienceEnum, // <- normalized to Prisma enum
      expiresAt,
      assets: files?.length
        ? {
            createMany: {
              data: files.map((a) => ({
                kind: a.kind,
                url: a.url,
                mimeType: a.mimeType || '',
                width: a.width ?? null,
                height: a.height ?? null,
                durationSec: a.durationSec ?? null,
                caption: a.caption ?? null,
              })),
            },
          }
        : undefined,
    },
    include: { assets: true },
  });

  // Persist envelope keys
  // - In real crypto mode: use encryptedKeys map produced above
  // - In dev fallback: insert "self" markers so the client can treat as readable
  const entries = DEV_FALLBACKS
    ? (() => {
        const targets = isPublic ? [author.id] : [author.id, ...audienceIds];
        return targets.map((uid) => [String(uid), 'self']);
      })()
    : Object.entries(encryptedKeys || {});

  if (entries.length) {
    await prisma.$transaction(
      entries.map(([userIdStr, encKey]) =>
        prisma.statusKey.upsert({
          where: {
            statusId_userId: { statusId: saved.id, userId: Number(userIdStr) },
          },
          update: { encryptedKey: encKey },
          create: {
            statusId: saved.id,
            userId: Number(userIdStr),
            encryptedKey: encKey,
          },
        })
      )
    );
  }

  return saved;
}

export default { getAudienceUserIds, createStatusService };

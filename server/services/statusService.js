// server/services/statusService.js
import { prisma } from '../utils/prismaClient.js';
import { isExplicit, cleanText } from '../utils/filter.js';
import { translateForTargets } from '../utils/translate.js';
import { encryptMessageForParticipants } from '../utils/encryption.js';

export async function getAudienceUserIds({ authorId, mode = 'MUTUALS', customIds = [] }) {
  if (mode === 'CUSTOM') return [...new Set(customIds.map(Number))].filter(Boolean);

  // Minimal mutuals example: adjust to your contact/friends model
  const mutuals = await prisma.contact.findMany({
    where: { userId: authorId, isMutual: true },
    select: { contactId: true },
  });
  return mutuals.map((c) => c.contactId);
}

export async function createStatusService({
  authorId,
  caption = '',
  files = [], // [{kind,url,mimeType,width?,height?,durationSec?,caption?}]
  audience = 'MUTUALS',
  customAudienceIds = [],
  expireSeconds = 24 * 3600,
}) {
  const author = await prisma.user.findUnique({
    where: { id: Number(authorId) },
    select: { id: true, preferredLanguage: true, allowExplicitContent: true, publicKey: true },
  });
  if (!author) throw new Error('Author not found');

  const audienceIds = await getAudienceUserIds({
    authorId: author.id,
    mode: audience,
    customIds: customAudienceIds,
  });
  if (!audienceIds.length) throw new Error('No audience');

  const users = await prisma.user.findMany({
    where: { id: { in: [author.id, ...audienceIds] } },
    select: {
      id: true,
      username: true,
      preferredLanguage: true,
      allowExplicitContent: true,
      publicKey: true,
    },
  });

  const explicit = caption ? isExplicit(caption) : false;
  const anyDisallow = users.some((u) => u.id !== author.id && !u.allowExplicitContent);
  const cap = caption
    ? anyDisallow || !author.allowExplicitContent
      ? cleanText(caption)
      : caption
    : '';

  let translations = null;
  let translatedFrom = author.preferredLanguage || 'en';
  if (cap) {
    const targetLangs = users
      .filter((u) => u.id !== author.id)
      .map((u) => u.preferredLanguage || 'en');
    const res = await translateForTargets(cap, translatedFrom, targetLangs);
    translations = Object.keys(res.map || {}).length ? res.map : null;
    translatedFrom = res.from || translatedFrom;
  }

  const { ciphertext, encryptedKeys } = await encryptMessageForParticipants(
    cap || '',
    author,
    users
  );

  const secs = Math.max(5, Math.min(24 * 3600, Number(expireSeconds) || 24 * 3600));
  const expiresAt = new Date(Date.now() + secs * 1000);

  const saved = await prisma.status.create({
    data: {
      author: { connect: { id: author.id } },
      captionCiphertext: ciphertext || null,
      encryptedKeys,
      translations,
      translatedFrom,
      isExplicit: explicit,
      audience,
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
    include: { assets: true, keys: true },
  });

  // Normalize envelope keys
  const entries = Object.entries(encryptedKeys || {});
  if (entries.length) {
    await prisma.$transaction(
      entries.map(([userIdStr, encKey]) =>
        prisma.statusKey.upsert({
          where: { statusId_userId: { statusId: saved.id, userId: Number(userIdStr) } },
          update: { encryptedKey: encKey },
          create: { statusId: saved.id, userId: Number(userIdStr), encryptedKey: encKey },
        })
      )
    );
  }

  return saved;
}

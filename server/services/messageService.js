// server/services/messageService.js
import { prisma } from '../utils/prismaClient.js';
import { isExplicit, cleanText } from '../utils/filter.js';
import { translateForTargets } from '../utils/translate.js';
import { encryptMessageForParticipants } from '../utils/encryption.js';

/**
 * Creates a message with full pipeline:
 *  - verifies membership (sender is in the room)
 *  - profanity filter based on sender/recipients
 *  - per-language translations (JSON map)
 *  - AES-GCM content encryption + NaCl-sealed session keys for all participants
 *  - optional expiry (per-message override beats user default)
 *
 * @param {Object} args
 * @param {number} args.senderId
 * @param {number|string} args.chatRoomId
 * @param {string} args.content                   // plaintext from client
 * @param {number} [args.expireSeconds]           // per-message TTL (seconds); overrides user default if provided
 * @param {string|null} [args.imageUrl=null]      // optional already-uploaded file url
 * @returns {Promise<Object>} Prisma message (selected fields) + { chatRoomId } for client routing
 */
export async function createMessageService({
  senderId,
  chatRoomId,
  content,
  expireSeconds,
  imageUrl = null,
}) {
  const roomIdNum = Number(chatRoomId);

  // 0) Validate presence
  if (!senderId || !roomIdNum || (!content && !imageUrl)) {
    throw new Error('Missing required fields');
  }

  // 1) Ensure sender exists and is a participant in this room
  const sender = await prisma.user.findUnique({
    where: { id: Number(senderId) },
    select: {
      id: true,
      username: true,
      preferredLanguage: true,
      allowExplicitContent: true,
      autoDeleteSeconds: true, // default TTL
      publicKey: true,
    },
  });
  if (!sender) throw new Error('Sender not found');

  const membership = await prisma.participant.findFirst({
    where: { chatRoomId: roomIdNum, userId: Number(senderId) },
  });
  if (!membership) throw new Error('Not a participant in this chat');

  // 2) Load participants (users) for filtering, translation, and encryption targets
  const participants = await prisma.participant.findMany({
    where: { chatRoomId: roomIdNum },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          preferredLanguage: true,
          allowExplicitContent: true,
          publicKey: true,
        },
      },
    },
  });

  const recipientUsers = participants.map((p) => p.user); // includes sender
  const recipientsExceptSender = recipientUsers.filter((u) => u.id !== sender.id);

  // 3) Profanity filtering (respect sender & recipients)
  const isMsgExplicit = content ? isExplicit(content) : false;
  const anyRecipientDisallows = recipientsExceptSender.some(
    (u) => !u.allowExplicitContent
  );
  const senderDisallows = !sender.allowExplicitContent;
  const mustClean = Boolean(content) && (anyRecipientDisallows || senderDisallows);
  const cleanContent = mustClean ? cleanText(content) : content;

  // 4) Per-language translations (store a map, not just a single translation)
  let translationsMap = null;
  let translatedFrom = sender.preferredLanguage || 'en';
  if (cleanContent) {
    const targetLangs = recipientsExceptSender.map(
      (u) => u.preferredLanguage || 'en'
    );
    const res = await translateForTargets(cleanContent, translatedFrom, targetLangs);
    translationsMap = Object.keys(res.map || {}).length ? res.map : null;
    translatedFrom = res.from || translatedFrom;
  }

  // 5) Expiry: per-message override beats user default
  const secs = Number.isFinite(expireSeconds)
    ? Number(expireSeconds)
    : (sender.autoDeleteSeconds || 0);
  const expiresAt = secs > 0 ? new Date(Date.now() + secs * 1000) : null;

  // 6) Encrypt message for all participants (AES-GCM + NaCl sealed session key per user)
  const { ciphertext, encryptedKeys } = await encryptMessageForParticipants(
    cleanContent || '',
    sender,
    recipientUsers // includes sender
  );

  // 7) Persist the message
  const saved = await prisma.message.create({
    data: {
      contentCiphertext: ciphertext,
      // Keep legacy JSON column during/after migration if present in your schema
      encryptedKeys, // { [userId]: base64([nonce|box]) }
      rawContent: content || null, // visible only to sender/admin per your GET route
      translations: translationsMap, // JSON map of lang -> translated text (plaintext)
      translatedFrom,
      isExplicit: isMsgExplicit,
      imageUrl: imageUrl || null,
      expiresAt,
      sender: { connect: { id: sender.id } },
      chatRoom: { connect: { id: roomIdNum } },
    },
    select: {
      id: true,
      contentCiphertext: true,
      encryptedKeys: true,
      translations: true,
      translatedFrom: true,
      isExplicit: true,
      imageUrl: true,
      expiresAt: true,
      createdAt: true,
      sender: { select: { id: true, username: true, publicKey: true } },
      chatRoomId: true,
    },
  });

  // 8) (Optional) If you’ve added the normalized MessageKey table, mirror keys there.
  //     This keeps JSON for backward compat while enabling O(1) lookups per user.
  //     We wrap in try/catch so this is a no-op if the table isn't present.
  try {
    const entries = Object.entries(encryptedKeys || {}); // [ [userId, encKey], ... ]
    if (entries.length) {
      await prisma.$transaction(
        entries.map(([userIdStr, encKey]) =>
          prisma.messageKey.upsert({
            where: {
              messageId_userId: {
                messageId: saved.id,
                userId: Number(userIdStr),
              },
            },
            update: { encryptedKey: encKey },
            create: {
              messageId: saved.id,
              userId: Number(userIdStr),
              encryptedKey: encKey,
            },
          })
        )
      );
    }
  } catch {
    // Table might not exist yet (during migration). Safe to ignore.
  }

  // 9) Shape for socket consumers (ensure chatRoomId is present)
  return {
    ...saved,
    chatRoomId: roomIdNum,
  };
}

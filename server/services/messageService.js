import prisma from '../utils/prismaClient.js';
import { isExplicit, cleanText } from '../utils/filter.js';
import { translateMessageIfNeeded } from '../utils/translate.js';
import { encryptMessageForParticipants } from '../utils/encryption.js';

/**
 * Creates a message in a chatroom using the same pipeline used by REST:
 * - checks membership
 * - profanity filter
 * - translation (optional)
 * - E2E encryption (AES-GCM + NaCl box per participant)
 * - persists to DB
 * Returns the created message (including sender {id, username, publicKey})
 */
export async function createMessageService({
  senderId,
  chatRoomId,
  content,         // plain text (already on server by design in Option A)
  fileUrl = null,  // if you've uploaded a file already, pass URL
}) {
  if (!content && !fileUrl) {
    throw new Error('Message must include text or file');
  }

  const sender = await prisma.user.findUnique({ where: { id: Number(senderId) } });
  if (!sender) throw new Error('Sender not found');

  // Check membership (non-admin)
  const membership = await prisma.participant.findFirst({
    where: { chatRoomId: Number(chatRoomId), userId: Number(senderId) }
  });
  if (!membership) {
    const err = new Error('Not a participant in this chat');
    err.statusCode = 403;
    throw err;
  }

  // Expiry
  let expiresAt = null;
  if (sender.autoDeleteSeconds) {
    expiresAt = new Date(Date.now() + sender.autoDeleteSeconds * 1000);
  }

  // Fetch all participants (to build recipient list)
  const participants = await prisma.participant.findMany({
    where: { chatRoomId: Number(chatRoomId) },
    include: { user: true },
  });

  const explicit = content ? isExplicit(content) : false;

  const requiresClean =
    !!content &&
    (!sender.allowExplicitContent || participants.some((p) => !p.user.allowExplicitContent));
  const cleanContent = content && requiresClean ? cleanText(content) : content;

  // Translate if needed
  const translationResult = content
    ? await translateMessageIfNeeded(cleanContent, sender, participants)
    : { translatedText: null, targetLang: null };

  let finalTranslatedContent = translationResult.translatedText;

  const recipients = participants.filter((p) => p.user.id !== sender.id);
  const anyReceiverDisallowsExplicit = recipients.some((p) => !p.user.allowExplicitContent);
  if (anyReceiverDisallowsExplicit && finalTranslatedContent && isExplicit(finalTranslatedContent)) {
    finalTranslatedContent = '[Message removed due to explicit content]';
  }

  // Encrypt for everyone (including sender)
  const recipientUsers = participants.map((p) => p.user);
  const { ciphertext, encryptedKeys } = await encryptMessageForParticipants(
    cleanContent || '',
    sender,
    recipientUsers
  );

  const message = await prisma.message.create({
    data: {
      contentCiphertext: ciphertext,
      encryptedKeys,
      rawContent: content || null, // keep if you're OK with at-rest plaintext (Option A)
      translatedContent: finalTranslatedContent,
      translatedFrom: sender.preferredLanguage || 'en',
      translatedTo: translationResult.targetLang,
      isExplicit: explicit,
      imageUrl: fileUrl,
      expiresAt,
      sender: { connect: { id: Number(senderId) } },
      chatRoom: { connect: { id: Number(chatRoomId) } },
    },
    include: {
      sender: { select: { id: true, username: true, publicKey: true } },
    },
  });

  return message;
}

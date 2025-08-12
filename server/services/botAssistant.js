import { generateAIResponse } from '../utils/generateAIResponse.js';
import { createMessageService } from './messageService.js';

const BOT_ID = Number(process.env.ORBIT_BOT_USER_ID || 0);

export async function maybeInvokeOrbitBot({ text, savedMessage, io, prisma }) {
  if (!BOT_ID) return; // require a real user id for OrbitBot
  const roomId = Number(savedMessage.chatRoomId);
  const senderId = Number(savedMessage.sender?.id || savedMessage.senderId);

  // Room setting
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    select: { aiAssistantMode: true },
  });
  if (!room || room.aiAssistantMode === 'off') return;
  if (senderId === BOT_ID) return;

  // Mention detection (for 'mention' mode)
  const mentioned = /(^|\s)@orbitbot\b|^\/ask(\s|$)/i.test(text || '');
  const shouldRespond =
    room.aiAssistantMode === 'always' ? true : mentioned;
  if (!shouldRespond) return;

  // Sender per-room opt-out
  const membership = await prisma.participant.findUnique({
    where: { userId_chatRoomId: { userId: senderId, chatRoomId: roomId } },
    select: { allowAIBot: true },
  });
  if (membership && membership.allowAIBot === false) return;

  // Build small, safe context (exclude users who opted out)
  const last = await prisma.message.findMany({
    where: { chatRoomId: roomId },
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: {
      rawContent: true,
      sender: { select: { id: true, username: true } },
    },
  });

  const allowedUserIds = new Set(
    (await prisma.participant.findMany({
      where: { chatRoomId: roomId, allowAIBot: true },
      select: { userId: true },
    })).map(p => p.userId)
  );

  const ctx = last
    .reverse()
    .filter(m => allowedUserIds.has(m.sender.id))
    .map(m => `${m.sender.username}: ${m.rawContent || ''}`)
    .join('\n')
    .slice(-2000); // trim

  const system = 'You are OrbitBot, a concise, friendly assistant in a group chat. Be helpful, avoid sensitive data, no PII, no medical/legal advice.';
  const userPrompt = (text || '').replace(/(^|\s)@orbitbot\b|^\/ask\s*/i, '').trim();

  let reply;
  try {
    reply = await generateAIResponse(userPrompt || (text || ''), { system, context: ctx });
  } catch {
    return;
  }

  // Post reply as OrbitBot (encrypted via the same pipeline)
  const botMsg = await createMessageService({
    senderId: BOT_ID,
    chatRoomId: roomId,
    content: reply,
  });

  io.to(String(roomId)).emit('receive_message', botMsg);
}

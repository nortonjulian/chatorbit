import { generateAIResponse } from '../utils/generateAIResponse.js';
import { createMessageService } from './messageService.js';
import { allow } from '../utils/tokenBucket.js';  // ⬅️ NEW

const COOLDOWN_DEFAULT = 120; // seconds

// in-memory throttle (swap for Redis in prod)
const lastReplyAt = new Map(); // key: `${userId}:${roomId}` -> ts
const key = (userId, roomId) => `${userId}:${roomId}`;

export async function maybeAutoRespondUsers({ savedMessage, prisma, io }) {
  const roomId = Number(savedMessage.chatRoomId);
  const senderId = Number(savedMessage.sender?.id || savedMessage.senderId);

  // don’t react to bot/auto replies to avoid loops
  if (!roomId || !senderId || savedMessage.isAutoReply) return;

  // ⬅️ Per-sender burst limit (e.g., 4 triggers / 10s). Silently drop if exceeded.
  if (!allow(senderId, 4, 10_000)) return;

  // load room participants w/ their responder config
  const participants = await prisma.participant.findMany({
    where: { chatRoomId: roomId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          enableAIResponder: true,
          autoResponderMode: true,         // 'off' | 'dm' | 'mention' | 'all'
          autoResponderCooldownSec: true,  // per-user cool-down
          autoResponderActiveUntil: true,  // optional availability window
          autoResponderSignature: true,
        },
      },
    },
  });

  const isDM = participants.length === 2;

  // detect mentions in group: @username (case-insensitive)
  const text = (savedMessage.rawContent || savedMessage.content || '').trim();
  const mentionedNames = new Set(
    (text.match(/@([a-z0-9_]+)/gi) || []).map((s) => s.slice(1).toLowerCase())
  );

  // candidates = everyone except sender, and who enabled auto-responder
  const candidates = participants
    .map((p) => p.user)
    .filter((u) => u.id !== senderId && u.enableAIResponder);

  const now = Date.now();

  for (const u of candidates) {
    // availability window
    if (u.autoResponderActiveUntil && now > new Date(u.autoResponderActiveUntil).getTime()) {
      continue;
    }

    // mode rules
    const mode = u.autoResponderMode || 'dm';
    if (mode === 'off') continue;
    if (mode === 'dm' && !isDM) continue;
    if (mode === 'mention' && !mentionedNames.has(String(u.username || '').toLowerCase())) continue;
    // mode === 'all' → always passes

    // per-user, per-room cool-down
    const cooldownMs = Math.max(10, u.autoResponderCooldownSec || COOLDOWN_DEFAULT) * 1000;
    const k = key(u.id, roomId);
    if (lastReplyAt.has(k) && now - lastReplyAt.get(k) < cooldownMs) continue;

    // craft prompt (style + safety)
    const system = `You are OrbitBot auto-replying on behalf of ${u.username}.
Be brief, helpful, and polite. Avoid commitments and sensitive/regulated advice.
Make it clear this is an auto-reply.`;

    let reply;
    try {
      reply = await generateAIResponse(text, { system });
    } catch {
      continue; // skip on LLM error
    }

    const signature = u.autoResponderSignature || '🤖 Auto-reply';
    const content = `${reply}\n\n${signature}`;

    const botMsg = await createMessageService({
      senderId: u.id,          // reply AS the user
      chatRoomId: roomId,
      content,
      isAutoReply: true,
    });

    io.to(String(roomId)).emit('receive_message', botMsg);
    lastReplyAt.set(k, now);
  }
}

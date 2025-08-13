import prisma from '../utils/prismaClient.js';

const enabled = (process.env.BOT_WEBHOOKS_ENABLED || 'false').toLowerCase() === 'true';

export function parseAllowedHosts() {
  const raw = process.env.BOT_ALLOWED_HOSTS || '';
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function hostAllowed(hostname) {
  const allowed = parseAllowedHosts();
  if (!allowed.length) return false;
  return allowed.some(pattern => {
    if (pattern === hostname) return true;
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1); // ".example.com"
      return hostname.endsWith(suffix);
    }
    return pattern === hostname;
  });
}

export function shouldDispatchForContentScope({ scope, botName, rawContent }) {
  const text = (rawContent || '').trim();
  if (!text) return false;

  switch (scope) {
    case 'ALL':
      return true;
    case 'COMMANDS':
      // simple: messages that begin with "/"
      return text.startsWith('/');
    case 'MENTIONS':
      // basic mention: @BotName (case-insensitive)
      if (!botName) return false;
      const re = new RegExp(`@${botName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      return re.test(text);
    default:
      return false;
  }
}

export function buildMessagePayload({ install, bot, message }) {
  // NOTE: this uses rawContent (plaintext the server already holds)
  // Only include what a bot needs; avoid leaking PII beyond the room.
  return {
    type: 'message.created',
    eventId: undefined, // will be filled by DB log (cuid)
    installId: install.id,
    bot: { id: bot.id, name: bot.name },
    chat: { id: message.chatRoomId },
    message: {
      id: message.id,
      content: message.rawContent || '',
      sender: {
        id: message.senderId ?? message.sender?.id,
        username: message.sender?.username,
      },
      attachments: (message.attachments || []).map(a => ({
        id: a.id, kind: a.kind, url: a.url, mimeType: a.mimeType,
        width: a.width, height: a.height, durationSec: a.durationSec, caption: a.caption,
      })),
      createdAt: message.createdAt,
    },
    meta: {
      contentScope: install.contentScope,
      timestamp: Date.now(),
    },
  };
}

/**
 * Queue events for all installs in the message's room that should see this content.
 * Non-blocking; dispatcher job will deliver to webhooks with retries.
 */
export async function enqueueBotEventsForMessage(savedMessage) {
  if (!enabled) return;

  // load installs + bot for this room
  const installs = await prisma.botInstall.findMany({
    where: { chatRoomId: savedMessage.chatRoomId, isEnabled: true },
    include: {
      bot: { select: { id: true, name: true, url: true, secret: true } },
    },
  });

  if (!installs.length) return;

  const queued = [];
  for (const inst of installs) {
    if (!inst.bot?.url) continue;

    // host allow-list check
    try {
      const { hostname, protocol } = new URL(inst.bot.url);
      if (protocol !== 'https:' && hostname !== 'localhost') continue;
      if (!hostAllowed(hostname)) continue;
    } catch {
      continue;
    }

    const ok = shouldDispatchForContentScope({
      scope: inst.contentScope,
      botName: inst.bot.name,
      rawContent: savedMessage.rawContent,
    });
    if (!ok) continue;

    const payload = buildMessagePayload({ install: inst, bot: inst.bot, message: savedMessage });

    const log = await prisma.botEventLog.create({
      data: {
        installId: inst.id,
        type: 'message.created',
        payload,
        status: 'pending',
        nextAttemptAt: new Date(), // ASAP
      },
    });

    // write back generated eventId into payload for receivers’ idempotency
    await prisma.botEventLog.update({
      where: { id: log.id },
      data: { payload: { ...payload, eventId: log.eventId } },
    });

    queued.push(log.id);
  }

  return queued.length;
}

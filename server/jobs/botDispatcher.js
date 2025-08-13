import prisma from '../utils/prismaClient.js';
import { signBody } from '../utils/botSign.js';

const enabled = (process.env.BOT_WEBHOOKS_ENABLED || 'false').toLowerCase() === 'true';
const MAX_RETRIES = Number(process.env.BOT_MAX_RETRIES || 5);
const TOLERANCE = Number(process.env.BOT_TOLERANCE_SECONDS || 300);

function backoffMs(attempt) {
  // 0 -> 5s, 1 -> 15s, 2 -> 45s, 3 -> 90s, 4 -> 180s ...
  const base = [5000, 15000, 45000, 90000, 180000][attempt] || 300000;
  return base;
}

export function startBotDispatcher(io) {
  if (!enabled) {
    return { stop: () => {} };
  }

  let timer = null;
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const now = new Date();

      const batch = await prisma.botEventLog.findMany({
        where: {
          status: 'pending',
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
        include: {
          install: {
            include: { bot: true, chatRoom: { select: { id: true } } },
          },
        },
      });

      for (const ev of batch) {
        const bot = ev.install.bot;
        if (!bot?.url || !bot.secret || ev.attempts >= MAX_RETRIES) {
          await prisma.botEventLog.update({
            where: { id: ev.id },
            data: { status: 'failed', lastError: 'invalid_config_or_retries_exhausted' },
          });
          continue;
        }

        const body = JSON.stringify(ev.payload);
        const ts = Date.now().toString();
        const sig = signBody(bot.secret, ts, body);

        let ok = false, status = 0, text = '';
        try {
          const res = await fetch(bot.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-ChatOrbit-Event': ev.type,
              'X-ChatOrbit-Install': String(ev.installId),
              'X-ChatOrbit-Timestamp': ts,
              'X-ChatOrbit-Signature': sig,
            },
            body,
          });
          status = res.status;
          text = await res.text().catch(() => '');
          ok = res.ok;
        } catch (e) {
          text = e?.message || 'fetch_error';
        }

        if (ok) {
          await prisma.botEventLog.update({
            where: { id: ev.id },
            data: { status: 'delivered', lastError: null },
          });
        } else {
          const attempts = ev.attempts + 1;
          const next = attempts >= MAX_RETRIES ? null : new Date(Date.now() + backoffMs(attempts - 1));
          await prisma.botEventLog.update({
            where: { id: ev.id },
            data: {
              attempts,
              nextAttemptAt: next,
              status: attempts >= MAX_RETRIES ? 'failed' : 'pending',
              lastError: `http_${status}:${text?.slice(0, 200)}`,
            },
          });
        }
      }
    } finally {
      running = false;
    }
  };

  timer = setInterval(tick, 5000);
  return {
    stop: () => timer && clearInterval(timer),
    tick,
  };
}

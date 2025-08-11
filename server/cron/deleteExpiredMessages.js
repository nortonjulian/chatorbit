import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Polls for expired messages and removes them. Emits a socket event so
 * online clients prune them immediately (no waiting for next fetch).
 *
 * @param {import('socket.io').Server} io
 * @param {number} [intervalMs=10000] how often to check (default 10s)
 */
export function initDeleteExpired(io, intervalMs = 10_000) {
  const timer = setInterval(async () => {
    const now = new Date();

    // Pull small batches to avoid huge deletes in one tick
    const expired = await prisma.message.findMany({
      where: { expiresAt: { lte: now } },
      select: { id: true, chatRoomId: true },
      take: 250,
    });

    if (!expired.length) return;

    // Delete
    await prisma.message.deleteMany({
      where: { id: { in: expired.map((m) => m.id) } },
    });

    // Notify rooms
    for (const m of expired) {
      io.to(String(m.chatRoomId)).emit('message_expired', { id: m.id });
    }
  }, intervalMs);

  // helpful when reloading dev server
  const stop = async () => {
    clearInterval(timer);
    await prisma.$disconnect();
  };
  return { stop };
}

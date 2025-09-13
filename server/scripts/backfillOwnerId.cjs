import prisma from '../utils/prismaClient.js';

async function main() {
  const rooms = await prisma.chatRoom.findMany({
    select: { id: true, ownerId: true },
  });

  let updated = 0;

  for (const r of rooms) {
    if (r.ownerId) continue;

    // Prefer explicit OWNER participant; else first ADMIN; else any participant
    const p = await prisma.participant.findFirst({
      where: { chatRoomId: r.id, role: { in: ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'] } },
      orderBy: [
        { role: 'asc' },        // OWNER < ADMIN < MODERATOR < MEMBER (lexicographic)
        { id: 'asc' },
      ],
    });

    if (!p) continue; // empty room—skip

    await prisma.chatRoom.update({
      where: { id: r.id },
      data: { ownerId: p.userId },
    });
    updated++;
  }

  console.log(`Backfilled ownerId for ${updated} room(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

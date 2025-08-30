import prisma from '../utils/prismaClient.js';

export async function bumpNumberActivity(userId) {
  const num = await prisma.phoneNumber.findFirst({ where: { assignedUserId: userId, status: { in: ['ASSIGNED','HOLD'] } } });
  if (!num) return;
  await prisma.phoneNumber.update({ where: { id: num.id }, data: { lastOutboundAt: new Date(), status: 'ASSIGNED', holdUntil: null, releaseAfter: null } });
}
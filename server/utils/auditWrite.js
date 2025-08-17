import prisma from '../utils/prismaClient.js';

export async function writeAudit({
  actorId,
  action,
  resource,
  resourceId,
  status = 200,
  ip = null,
  userAgent = null,
  metadata = null,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        resource,
        resourceId: resourceId?.toString() || null,
        status,
        ip,
        userAgent,
        metadata,
      },
    });
  } catch {}
}

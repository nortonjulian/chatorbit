import cron from 'node-cron';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

// Every hour at minute 5
export function startCleanupJobs() {
  cron.schedule('5 * * * *', async () => {
    const now = new Date();
    try {
      const res = await prisma.provisionLink.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }],
        },
      });
      if (res.count)
        console.log(`🧹 Deleted ${res.count} expired/used ProvisionLinks`);
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  });
}

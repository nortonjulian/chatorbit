import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
  });

// Reuse the client across HMR / dev restarts
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

export { prisma };
export default prisma;

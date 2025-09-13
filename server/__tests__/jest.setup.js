afterAll(async () => {
  try {
    const prismaModule = await import('../utils/prismaClient.js');
    const prisma = prismaModule.default || prismaModule.prisma || prismaModule;
    if (prisma?.$disconnect) {
      await prisma.$disconnect();
    }
  } catch {
    // ignore if path/module differs
  }
});

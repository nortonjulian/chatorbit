import http from 'http';
import { createApp } from './app.js';
import { initSocket } from './socket.js';
import { startCleanupJobs, stopCleanupJobs } from './cron/cleanup.js';

export function makeApp() {
  const app = createApp();

  // Route dumper for tests
  app.get('/__routes_dump', (req, res) => {
    const layers = app._router?.stack || [];
    const hasStatusRouter = layers.some((layer) => {
      if (layer?.name === 'router' && layer?.regexp) return String(layer.regexp).includes('^\\/status');
      if (layer?.route?.path === '/status') return true;
      return false;
    });
    res.json({ statusFlag: String(process.env.STATUS_ENABLED || ''), hasStatusRouter });
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const app = makeApp();
  const PORT = process.env.PORT || 5002;
  const server = http.createServer(app);

  // Wire Socket.IO
  const { io, emitToUser, close: closeSockets } = initSocket(server);
  app.set('io', io);
  app.set('emitToUser', emitToUser);

  // Start background cleanup cron
  startCleanupJobs();

  // Start HTTP
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  async function shutdown(sig) {
    console.log(`${sig}: shutting down...`);

    // Stop cron tasks first to avoid new work
    try {
      stopCleanupJobs();
    } catch (e) {
      console.warn('cleanup stop error:', e?.message || e);
    }

    // Close websockets/redis adapter
    try {
      if (closeSockets) await closeSockets();
    } catch (e) {
      console.warn('socket close error:', e?.message || e);
    }

    // Disconnect Prisma
    try {
      const { default: prisma } = await import('./utils/prismaClient.js');
      await prisma.$disconnect?.();
    } catch {}

    // Close HTTP server
    server.close(() => process.exit(0));

    // Safety exit if close hangs
    setTimeout(() => process.exit(0), 5000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

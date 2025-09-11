import http from 'http';
import { createApp } from './app.js';
import statusRouter from './routes/status.js';
import { initSocket } from './socket.js';

export function makeApp() {
  const app = createApp();

  const statusEnabled =
    String(process.env.STATUS_ENABLED || '').toLowerCase() === 'true';

  if (statusEnabled) {
    app.use('/status', statusRouter);
  }

  // robust route dumper for tests
  app.get('/__routes_dump', (req, res) => {
    const layers = app._router?.stack || [];
    const hasStatusRouter = layers.some((layer) => {
      if (layer?.name === 'router' && layer?.regexp) {
        return String(layer.regexp).includes('^\\/status');
      }
      if (layer?.route?.path === '/status') return true;
      return false;
    });

    res.json({
      statusFlag: String(process.env.STATUS_ENABLED || ''),
      hasStatusRouter,
    });
  });

  app.get('/health', (_req, res) => res.json({ ok: true }));

  return app;
}

// If not under test, start the HTTP + socket server
if (process.env.NODE_ENV !== 'test') {
  const app = makeApp();
  const PORT = process.env.PORT || 5002;

  const server = http.createServer(app);

  // wire sockets against the server
  const { io, emitToUser } = initSocket(server);
  app.set('io', io);
  app.set('emitToUser', emitToUser);

  // optional: background jobs, adapters, etc.
  // e.g. registerStatusExpiryJob(io); ensureRedis(); io.adapter(...);

  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

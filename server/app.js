import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import listEndpoints from 'express-list-endpoints';

// Routers / middleware
import statusRoutes from './routes/status.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import messagesRouter from './routes/messages.js';
import chatroomsRouter from './routes/chatrooms.js';
import randomChatsRouter from './routes/randomChats.js';
import contactRoutes from './routes/contacts.js';
import invitesRouter from './routes/invites.js';
import mediaRouter from './routes/media.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  /* =========================
   *   Middleware
   * ========================= */
  app.use(cookieParser());
  app.use(express.json());
  app.use(
    helmet({
      contentSecurityPolicy: false, // keep your tuned CSP if you like
    })
  );
  app.use(compression());
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (origin.startsWith('http://localhost')) return cb(null, true);
        return cb(new Error('CORS blocked'));
      },
      credentials: true,
    })
  );

  /* =========================
   *   Rate limiters
   * ========================= */
  const isLoad =
    process.env.NODE_ENV === 'loadtest' || process.env.LOADTEST === '1';
  const RL_HUGE = 100000;
  const statusReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isLoad ? RL_HUGE : 60,
    standardHeaders: true,
    legacyHeaders: false,
  });

  /* =========================
   *   Base routes
   * ========================= */
  app.get('/', (_req, res) => res.send('Welcome to ChatOrbit API!'));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  // Primary routers
  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/chatrooms', chatroomsRouter);
  app.use('/messages', messagesRouter);
  app.use('/random-chats', randomChatsRouter);
  app.use('/contacts', contactRoutes);
  app.use('/invites', invitesRouter);
  app.use('/media', mediaRouter);

  /* =========================
   *   Status feature
   * ========================= */
  const STATUS_ENABLED =
    String(process.env.STATUS_ENABLED || '').toLowerCase() === 'true';
  console.log('STATUS_ENABLED =', STATUS_ENABLED);
  if (STATUS_ENABLED) {
    console.log('✅ Status routes ENABLED');
    app.use('/status', statusReadLimiter);
    app.use('/status', statusRoutes);
  } else {
    console.log('🚫 Status routes DISABLED');
  }

  /* =========================
   *   Dev: route dump
   * ========================= */
  if (process.env.NODE_ENV !== 'production') {
    app.get('/__routes_dump', (_req, res) => {
      const routes = listEndpoints(app)
        .flatMap((r) =>
          (r.methods || []).map((m) => ({ method: m, path: r.path }))
        )
        .sort(
          (a, b) =>
            a.path.localeCompare(b.path) || a.method.localeCompare(b.method)
        );
      res.json({
        statusFlag: String(process.env.STATUS_ENABLED || ''),
        hasStatusRouter: routes.some((r) => String(r.path).startsWith('/status')),
        routes,
      });
    });
  }

  /* =========================
   *   Errors last
   * ========================= */
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}



import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import listEndpoints from 'express-list-endpoints';
import path from 'path';
import { fileURLToPath } from 'url';

// Sentry + logging
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import pinoHttp from 'pino-http';
import logger from './utils/logger.js';

// Deep health
import healthzRouter from './routes/healthz.js';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';

  /* =========================
   *   Sentry (init + handlers first, prod only)
   * ========================= */
  if (isProd) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'dev',
      release: process.env.COMMIT_SHA, // unified name
      integrations: [nodeProfilingIntegration()],
      tracesSampleRate: Number(process.env.SENTRY_TRACES_RATE ?? 0.2),
      profilesSampleRate: Number(process.env.SENTRY_PROFILES_RATE ?? 0.1),
      beforeSend(event) {
        if (event.request) {
          delete event.request.headers?.cookie;
          delete event.request.headers?.authorization;
        }
        return event;
      },
    });
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
  }

  /* =========================
   *   HTTP structured logs
   * ========================= */
  app.use(
    pinoHttp({
      logger,
      redact: { paths: ['req.headers.authorization', 'req.headers.cookie'] },
      customLogLevel: (req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    })
  );

  /* =========================
   *   Core middleware
   * ========================= */
  app.use(cookieParser());
  app.use(express.json());
  app.use(
    helmet({
      contentSecurityPolicy: false, // keep your tuned CSP if desired
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
   *   Static assets (uploads)
   * ========================= */
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  /* =========================
   *   Health endpoints
   * ========================= */
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/healthz', healthzRouter); // DB + Redis checks

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
  logger.info({ STATUS_ENABLED }, 'Status routes feature flag');
  if (STATUS_ENABLED) {
    app.use('/status', statusReadLimiter);
    app.use('/status', statusRoutes);
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
   *   Error handlers (Sentry first in prod)
   * ========================= */
  if (isProd) {
    app.use(Sentry.Handlers.errorHandler());
  }
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import listEndpoints from 'express-list-endpoints';
import path from 'path';
import { fileURLToPath } from 'url';
import { initCrons } from './cron/index.js';
initCrons();

// Sentry + logging
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { requestId } from './middleware/requestId.js';
import pinoHttp from 'pino-http';
import logger from './utils/logger.js';

// Deep health
import healthzRouter from './routes/healthz.js';

// Routers / middleware
import backupsRouter from './routes/backups.js';
import smsWebhooks from './routes/smsWebhooks.js';
import devicesRouter from './routes/devices.js';
import statusRoutes from './routes/status.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import messagesRouter from './routes/messages.js'; // test-friendly in-memory when NODE_ENV=test
import callsRouter from './routes/calls.js';
import roomsRouter from './routes/rooms.js';       // test-friendly in-memory when NODE_ENV=test
import followsRouter from './routes/follows.js';
import randomChatsRouter from './routes/randomChats.js';
import contactRoutes from './routes/contacts.js';
import invitesRouter from './routes/invites.js';
import mediaRouter from './routes/media.js';
import billingRouter from './routes/billing.js';   // static import (no top-level await)
import billingWebhook from './routes/billingWebhook.js';
import contactsImportRouter from './routes/contactsImport.js';
import uploadsRouter from './routes/uploads.js';
import smsRouter from './routes/sms.js';
import voiceRouter from './routes/voice.js';
import settingsForwardingRouter from './routes/settings.forwarding.js';

// Errors
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

// CSRF + Rate limiters
import { buildCsrf, setCsrfCookie } from './middleware/csrf.js';
import {
  limiterLogin,
  limiterRegister,
  limiterReset,
  limiterInvites,
  limiterAI,
  limiterMedia,
  limiterGenericMutations,
} from './middleware/rateLimits.js';

// 🔐 Security middlewares
import { corsConfigured } from './middleware/cors.js';
import { secureHeaders } from './middleware/secureHeaders.js';
import { csp } from './middleware/csp.js';
import { hppGuard } from './middleware/hpp.js';
import { httpsRedirect } from './middleware/httpsRedirect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  // behind proxy/CDN (needed for secure cookies, correct IPs, https detection)
  app.set('trust proxy', true);

  /* =======================================================
   *  Very-early security plumbing
   *  (kept before most things; raw Stripe webhook still comes before body parsers)
   * ======================================================= */
  app.use(httpsRedirect());      // redirect http -> https in prod
  app.use(corsConfigured());     // CORS allowlist (credentials on)
  // (Removed early hppGuard(); we’ll mount after body parsers)
  app.use(secureHeaders());      // Helmet baseline (noSniff, frameguard, referrer, etc.)
  app.use(csp());                // Strict CSP with per-response nonce

  /* =======================================================
   *  Stripe Webhook: MUST use raw body BEFORE json parser
   * ======================================================= */
  app.post('/billing/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
    // Hand off to router’s /billing/webhook; we just needed a raw body here.
    next('route');
  });

  /* =========================
   *   Core middleware (order matters)
   * ========================= */
  app.use(cookieParser());
  app.use(compression());

  // Ensure requestId is set before logging so pinoHttp can read req.id
  app.use(requestId());

  // Body parsers (centralized limits)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '512kb' }));

  // HTTP Parameter Pollution guard AFTER body parsers; collapse arrays except allow-list
  app.use(hppGuard({ allow: ['tags', 'ids'] }));

  // Structured HTTP logs
  app.use(
    pinoHttp({
      logger,
      autoLogging: true,
      genReqId: (req) => req.id, // use our id
      customProps: (req) => ({
        requestId: req.id,
        userId: req.user?.id ?? null,
        method: req.method,
        path: req.originalUrl || req.url,
      }),
      customLogLevel: (req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
      },
    })
  );

  /* =========================
   *   Sentry (prod only)
   * ========================= */
  if (isProd) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'dev',
      release: process.env.COMMIT_SHA,
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
   *   CSRF (skip webhook). In tests, no-op
   * ========================= */
  const csrfMw = isTest
    ? (_req, _res, next) => next()
    : buildCsrf({ isProd, cookieDomain: process.env.COOKIE_DOMAIN });

  app.use((req, res, next) => {
    if (req.path === '/billing/webhook') return next();
    return csrfMw(req, res, next);
  });

  // Refresh XSRF-TOKEN cookie on GETs
  app.use((req, res, next) => {
    if (!isTest && req.method === 'GET') setCsrfCookie(req, res);
    next();
  });

  // Explicit CSRF priming endpoint so the client gets 200 (not 404)
  app.get('/auth/csrf', (_req, res) => res.json({ ok: true }));

  /* =========================
   *   Health endpoints
   * ========================= */
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/healthz', healthzRouter);

  /* =========================
   *   Rate limiters
   * ========================= */
  const isLoad = process.env.NODE_ENV === 'loadtest' || process.env.LOADTEST === '1';
  const RL_HUGE = 100000;
  const statusReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isLoad ? RL_HUGE : 60,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Specific limits by area
  app.use(['/auth/login', '/auth/2fa'], limiterLogin);
  app.use('/auth/register', limiterRegister);
  app.use(['/auth/forgot-password', '/auth/reset-password'], limiterReset);
  app.use('/invites', limiterInvites);
  app.use('/ai', limiterAI);
  app.use('/media', limiterMedia);

  // Fallback: limit other mutations
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return limiterGenericMutations(req, res, next);
    }
    next();
  });

  /* =========================
   *   Base routes
   * ========================= */
  app.get('/', (_req, res) => res.send('Welcome to ChatOrbit API!'));

  // Webhook + Billing (the webhook raw body pre-route already ran)
  app.use('/billing', billingWebhook);
  app.use('/billing', billingRouter);

  // Primary app routers
  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/calls', callsRouter);
  app.use('/webhooks/sms', smsWebhooks);
  app.use('/voice', voiceRouter);

  // IMPORTANT: tests hit /rooms and /messages.
  app.use('/rooms', roomsRouter);
  app.use('/chatrooms', roomsRouter);
  app.use('/messages', messagesRouter);

  app.use('/follows', followsRouter);
  app.use('/random-chats', randomChatsRouter);
  app.use('/contacts', contactRoutes);
  app.use('/invites', invitesRouter);
  app.use('/media', mediaRouter);
  app.use('/devices', devicesRouter);
  app.use('/backups', backupsRouter);
  app.use('/uploads', uploadsRouter);
  app.use('/sms', smsRouter);
  app.use('/settings', settingsForwardingRouter);

  // Contacts bulk import (mounted under /api to match your Vite proxy)
  app.use('/api', contactsImportRouter);

  /* =========================
   *   Status feature flag
   * ========================= */
  const STATUS_ENABLED_FLAG = String(process.env.STATUS_ENABLED || '').toLowerCase() === 'true';
  const STATUS_ENABLED = isTest ? true : STATUS_ENABLED_FLAG; // always enable in tests
  logger.info(
    { service: 'chatorbit-server', env: process.env.NODE_ENV, STATUS_ENABLED },
    'Status routes feature flag'
  );
  if (STATUS_ENABLED) {
    app.use('/status', statusReadLimiter);
    app.use('/status', statusRoutes);
  }

  /* =========================
   *   Dev: route dump
   * ========================= */
  if (!isProd) {
    app.get('/__routes_dump', (_req, res) => {
      const routes = listEndpoints(app)
        .flatMap((r) => (r.methods || []).map((m) => ({ method: m, path: r.path })))
        .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
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

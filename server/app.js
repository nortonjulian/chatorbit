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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  // behind proxy/CDN (needed for secure cookies and correct IPs)
  app.set('trust proxy', 1);

  /* =======================================================
   *  CORS (FIRST) – so even errors include CORS headers
   * ======================================================= */
  const envOrigins = String(process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const devDefaults = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.API_ORIGIN || '',     // allow self if defined
    process.env.SOCKET_ORIGIN || ''
  ].filter(Boolean);

  const allowedOrigins = envOrigins.length ? envOrigins : devDefaults;

  const corsConfig = {
    origin(origin, cb) {
      // allow same-origin / non-browser tools (no Origin header)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('CORS blocked'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-XSRF-TOKEN'],
    exposedHeaders: ['Set-Cookie'],
  };

  app.use(cors(corsConfig));
  app.options('*', cors(corsConfig)); // handle all preflights

  /* =======================================================
   *  Stripe Webhook: MUST use raw body BEFORE json parser
   * ======================================================= */
  app.post('/billing/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
    // Hand off to router’s /billing/webhook; we just needed a raw body here.
    next('route');
  });

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
   *   Core middleware (after raw webhook)
   * ========================= */
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '512kb' }));

  // Helmet with CSP & HSTS
  const CDN_ORIGINS = String(process.env.CDN_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          connectSrc: ["'self'", ...allowedOrigins, process.env.SOCKET_ORIGIN || '', process.env.API_ORIGIN || ''].filter(Boolean),
          imgSrc: ["'self'", 'data:', 'blob:', ...CDN_ORIGINS],
          mediaSrc: ["'self'", 'data:', 'blob:', ...CDN_ORIGINS],
          scriptSrc: ["'self'", "'unsafe-inline'"], // replace with nonces when ready
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          upgradeInsecureRequests: isProd ? [] : null,
        },
      },
      hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(compression());

  // CSRF (skip webhook). In tests, CSRF is a no-op to unblock supertest flows.
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
   *   Static assets (uploads)
   * ========================= */
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

  // Contacts bulk import (mounted under /api to match your Vite proxy)
  app.use('/api', contactsImportRouter);

  /* =========================
   *   Status feature flag
   * ========================= */
  const STATUS_ENABLED_FLAG = String(process.env.STATUS_ENABLED || '').toLowerCase() === 'true';
  const STATUS_ENABLED = isTest ? true : STATUS_ENABLED_FLAG; // always enable in tests
  logger.info({ service: 'chatorbit-server', env: process.env.NODE_ENV, STATUS_ENABLED }, 'Status routes feature flag');
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

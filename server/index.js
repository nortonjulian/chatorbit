import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';

import { initDeleteExpired } from './cron/deleteExpiredMessages.js';

import adminReportsRouter from './routes/adminReports.js';
import adminUsersRouter from './routes/adminUsers.js';
import adminAuditRouter from './routes/adminAudit.js';
import chatroomsRouter from './routes/chatrooms.js';
import messagesRouter from './routes/messages.js';
import authRouter from './routes/auth.js';
import randomChatsRouter from './routes/randomChats.js';
import contactRoutes from './routes/contacts.js';
import usersRouter from './routes/users.js';
import invitesRouter from './routes/invites.js';
import aiRouter from './routes/ai.js';
import groupInvitesRouter from './routes/groupInvites.js';
import mediaRouter from './routes/media.js';
import statusRoutes from './routes/status.js';
import devicesRouter from './routes/devices.js';
import featuresRouter from './routes/features.js';
import filesRouter from './routes/files.js';
import backupsRouter from './routes/backups.js';
import numbersRouter from './routes/numbers.js';

// Accessibility (hearing-impaired)
import a11yRouter from './routes/a11y.js';
import { attachCaptionWS } from './ws/captions.js';
import { startTranscriptRetentionJob } from './jobs/transcriptRetention.js';

// Calls / ICE
import { registerCallHandlers } from './sockets/calls.js';
import iceRouter from './routes/ice.js';

// Billing
import billingRouter from './routes/billing.js';
import billingWebhook from './routes/billingWebhook.js';

import { registerStatusExpiryJob } from './jobs/statusExpiry.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

// Bots
import botsRouter from './routes/bots.js';
import { startBotDispatcher } from './jobs/botDispatcher.js';

// Socket.IO
import { initSocket } from './socket.js';
import { cookieSocketAuth } from './middleware/socketAuth.js';

// Plan gates (example endpoint only)
import { requireAuth } from './middleware/auth.js';
import { requirePremium } from './middleware/plan.js';

import { startCleanupJobs } from './cleanup.js';

// Redis adapter (multi-node)
import { createAdapter } from '@socket.io/redis-adapter';
import { ensureRedis, redisPub, redisSub } from './utils/redisClient.js';

import premiumFeaturesRouter from './routes/premiumFeatures.js';
import aiPowerRouter from './routes/ai.power.js';

// Random chat queue (age-aware)
import {
  enqueueWaiting,
  tryDequeuePartner,
  savePair,
  getPair,
  deletePair,
} from './random/queue.js';

// Token bucket
import { allow } from './utils/tokenBucket.js';

dotenv.config();

import { assertRequiredEnv } from './utils/env.js';
assertRequiredEnv(['JWT_SECRET']);

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5001;

app.set('trust proxy', 1);

/**
 * ---- CORS / Security Config ----
 *
 * FRONTEND_ORIGIN: the primary frontend (e.g., https://www.chatorbit.com)
 * CORS_ORIGINS: optional, comma-separated list of additional origins (e.g., dev)
 * CDN_ORIGIN: optional CDN host for static assets
 */
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const EXTRA_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = [FRONTEND_ORIGIN, ...EXTRA_ORIGINS].filter(Boolean);

const CDN_ORIGIN = process.env.CDN_ORIGIN || '';
const IMG_ORIGINS = ["'self'", 'data:', 'blob:'];
if (CDN_ORIGIN) IMG_ORIGINS.push(CDN_ORIGIN);

app.disable('x-powered-by');

/**
 * Helmet CSP with dynamic connect-src to include allowed frontends and ws/wss.
 * If your Socket.IO or API is at api.chatorbit.com, browser connections still
 * originate from the frontend origin; keep both API and WS in connect-src.
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': IMG_ORIGINS,
        'connect-src': [
          "'self'",
          ...ALLOWED_ORIGINS,
          'ws:',
          'wss:',
        ],
        'font-src': ["'self'", 'data:', ...(CDN_ORIGIN ? [CDN_ORIGIN] : [])],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
      },
    },
    hsts:
      process.env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

/**
 * Express CORS config — allow cookies and multiple origins.
 * We accept requests with no Origin (e.g., curl) and Origins in the allowlist.
 */
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // non-browser clients
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error('CORS blocked'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
  })
);

app.use(compression());

// --- HTTP server (Socket.IO + WS captions) ---
const server = http.createServer(app);

// --- Socket.IO (CORS also configured inside initSocket) ---
const { io, emitToUser } = initSocket(server);
app.set('emitToUser', emitToUser);

// Example extra Socket.IO tuning
io.engine.opts.maxHttpBufferSize = 1e7;
io.opts = {
  ...io.opts,
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error('CORS blocked'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
};

// Socket cookie middleware (if you have extra logic)
import { cookieSocketAuth } from './middleware/socketAuth.js';
cookieSocketAuth(io);

// --- Rate limiter for auth-sensitive routes ---
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many requests, please try again later.' },
});

// ---------- Parsers (⚠️ webhook raw BEFORE json) ----------
app.use(cookieParser());

// Dedicated raw-body Stripe webhook
const webhookApp = express();
webhookApp.post(
  '/billing/webhook',
  express.raw({ type: 'application/json' }),
  billingWebhook
);
app.use(webhookApp);

// Now safe for JSON parsing
app.use(express.json());

// Lightweight CSRF header check for state-changing routes
app.use((req, res, next) => {
  const method = req.method.toUpperCase();
  const url = req.originalUrl || req.url || '';
  if (url.startsWith('/socket.io/') || url === '/billing/webhook') return next();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const ok = req.headers['x-requested-with'] === 'XMLHttpRequest';
    if (!ok) return res.status(403).json({ error: 'CSRF check failed' });
  }
  next();
});

// ---------- Routes ----------
app.get('/', (_req, res) => res.send('Welcome to ChatOrbit API!'));
app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth/login', authLimiter);
app.use('/auth/forgot-password', authLimiter);

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/chatrooms', chatroomsRouter);
app.use('/messages', messagesRouter);
app.use('/random-chats', randomChatsRouter);
app.use('/contacts', contactRoutes);
app.use('/invites', invitesRouter);
app.use('/media', mediaRouter);
app.use('/ice-servers', iceRouter);

if (process.env.STATUS_ENABLED === 'true') {
  app.use('/status', statusRoutes);
}

app.use('/devices', devicesRouter);
app.use('/features', featuresRouter);
app.use(groupInvitesRouter);
app.use('/files', filesRouter);
app.use('/backups', backupsRouter);
app.use('/numbers', numbersRouter);

// AI routes
app.use('/ai', aiRouter);
app.use('/features', premiumFeaturesRouter);
app.use('/ai', aiPowerRouter);

// Example premium-only endpoint
app.get('/ai/power-feature', requireAuth, requirePremium, (_req, res) => {
  res.json({ ok: true });
});

// Accessibility routes (live captions, voice-note STT)
app.use(a11yRouter);

// Private bots
app.use('/bots', botsRouter);

// Admin APIs
app.use('/admin/reports', adminReportsRouter);
app.use('/admin/users', adminUsersRouter);
app.use('/admin/audit', adminAuditRouter);

// 404 then error handler (must be LAST)
app.use(notFoundHandler);
app.use(errorHandler);

// ---------- WS & background jobs ----------
attachCaptionWS(server);
startTranscriptRetentionJob();

// Random chat (Redis-backed; age-aware)
io.on('connection', (socket) => {
  console.log(`🟢 User connected: ${socket.id}`);

  socket.on('join_user', () => {
    const uid = Number(socket.user?.id);
    if (uid) socket.join(`user:${uid}`);
  });

  socket.on('find_random_chat', async (username) => {
    try {
      const meDb = await prisma.user.findUnique({
        where: { id: socket.user?.id },
        select: {
          ageBand: true,
          wantsAgeFilter: true,
          randomChatAllowedBands: true,
        },
      });

      const allowed = Array.isArray(meDb?.randomChatAllowedBands)
        ? meDb.randomChatAllowedBands
        : [];

      const me = {
        socketId: socket.id,
        username,
        userId: socket.user?.id,
        ageBand: meDb?.ageBand || null,
        wantsAgeFilter: meDb?.wantsAgeFilter !== false, // default ON
        allowed,
      };

      const partner = await tryDequeuePartner(me);

      if (partner && partner.socketId !== socket.id) {
        const roomId = `random:${partner.socketId}:${socket.id}`;
        socket.join(roomId);
        io.to(partner.socketId).socketsJoin?.(roomId);

        await savePair(roomId, me, partner);

        io.to(socket.id).emit('pair_found', {
          roomId,
          partner: partner.username,
        });
        io.to(partner.socketId).emit('pair_found', {
          roomId,
          partner: username,
        });
      } else {
        await enqueueWaiting(me);
        socket.emit('no_partner', {
          message:
            'No compatible partner online right now. Want to chat with OrbitBot instead?',
        });
      }
    } catch (err) {
      console.error('find_random_chat failed:', err);
      socket.emit('no_partner', {
        message: 'Matchmaking temporarily unavailable.',
      });
    }
  });

  socket.on('skip_random_chat', async ({ roomId }) => {
    try {
      if (!roomId) return;
      const pair = await getPair(roomId);
      if (!pair) return;

      const { a, b } = pair;
      const other = a.socketId === socket.id ? b : a;

      io.to(other.socketId).emit(
        'chat_skipped',
        'Partner skipped. Returning to lobby.'
      );

      io.in(roomId).socketsLeave(roomId);
      await deletePair(roomId);

      await enqueueWaiting(a);
      await enqueueWaiting(b);
    } catch (err) {
      console.error('skip_random_chat failed:', err);
    }
  });

  socket.on('save_random_chat', async ({ roomId, messages }) => {
    try {
      const pair = await getPair(roomId);
      if (!pair) return;
      const [s1, s2] = [pair.a, pair.b];

      const savedRoom = await prisma.randomChatRoom.create({
        data: {
          participants: { connect: [{ id: s1.userId }, { id: s2.userId }] },
          messages: {
            create: (messages || []).map((m) => ({
              content: m.content,
              rawContent: m.rawContent || m.content,
              translatedContent: m.translatedContent || null,
              translatedFrom: m.translatedFrom || null,
              translatedTo: m.translatedTo || null,
              sender: { connect: { id: m.senderId } },
              isExplicit: m.isExplicit || false,
              createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
            })),
          },
        },
        include: { participants: true, messages: true },
      });

      io.to(roomId).emit('chat_saved', { chatId: savedRoom.id });
    } catch (err) {
      console.error('Error saving random chat:', err);
      io.to(roomId).emit('chat_save_error', 'Could not save chat');
    }
  });

  socket.on('join_room', (chatRoomId) => socket.join(String(chatRoomId)));
  socket.on('leave_room', (chatRoomId) => socket.leave(String(chatRoomId)));
  socket.on('typing', ({ chatRoomId, username }) => {
    socket.to(String(chatRoomId)).emit('user_typing', { username });
  });
  socket.on('stop_typing', (chatRoomId) => {
    socket.to(String(chatRoomId)).emit('user_stopped_typing');
  });

  socket.on('send_message', async (messageData) => {
    try {
      const senderId = socket.user?.id;
      if (!allow(senderId, 10, 10_000)) return;

      const { content, chatRoomId, expireSeconds } = messageData || {};
      if (!content || !senderId || !chatRoomId) return;

      const { createMessageService, maybeAutoTranslate } = await import(
        './services/messageService.js'
      );
      const saved = await createMessageService({
        senderId,
        chatRoomId,
        content,
        expireSeconds,
      });
      io.to(String(chatRoomId)).emit('receive_message', saved);

      const { maybeInvokeOrbitBot } = await import('./services/botAssistant.js');
      const { maybeAutoRespondUsers } = await import('./services/autoResponder.js');

      maybeAutoTranslate({ savedMessage: saved, io, prisma }).catch(() => {});
      maybeInvokeOrbitBot({
        text: content,
        savedMessage: saved,
        io,
        prisma,
      }).catch(() => {});
      maybeAutoRespondUsers({ savedMessage: saved, prisma, io }).catch(() => {});
    } catch (e) {
      console.error('Message save failed:', e);
    }
  });

  socket.on('message_copied', async ({ messageId }) => {
    let m;
    try {
      m = await prisma.message.findUnique({
        where: { id: Number(messageId) },
        select: { id: true, senderId: true, chatRoomId: true },
      });
    } catch {}
    if (!m) return;

    io.to(String(m.chatRoomId)).emit('message_copy_notice', {
      messageId: m.id,
      toUserId: m.senderId,
      byUserId: socket.user?.id,
    });
  });

  registerCallHandlers({ io, socket, prisma });
});

// Expose io for other modules
app.set('io', io);

// Start sweeper once io exists
const { stop: stopDeleteExpired } = initDeleteExpired(io);
const { stop: stopBotDispatcher } = startBotDispatcher(io);

// --- Bootstrap with Redis adapter first ---
async function start() {
  try {
    await ensureRedis();
    io.adapter(createAdapter(redisPub, redisSub));

    if (process.env.STATUS_ENABLED === 'true') {
      registerStatusExpiryJob(io);
    }

    startCleanupJobs();

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}
start();

// Graceful shutdown
async function shutdown(code = 0) {
  try {
    await stopDeleteExpired?.();
    await stopBotDispatcher?.();
    await prisma.$disconnect();
  } finally {
    process.exit(code);
  }
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

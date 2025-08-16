import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

import { initDeleteExpired } from './cron/deleteExpiredMessages.js';

import adminReportsRouter from './routes/adminReports.js';
import adminUsersRouter from './routes/users.js';
import adminAuditRouter   from './routes/adminAudit.js';
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

import helmet from 'helmet';
import compression from 'compression';

import filesRouter from './routes/files.js';

import { registerStatusExpiryJob } from './jobs/statusExpiry.js';

import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

// ✅ NEW: Private bots
import botsRouter from './routes/bots.js';
import { startBotDispatcher } from './jobs/botDispatcher.js';

// ✅ Socket.IO bootstrap (returns { io, emitToUser })
import { initSocket } from './socket.js';

import { startCleanupJobs } from './cleanup.js';

// ✅ Redis adapter for Socket.IO (multi-node ready)
import { createAdapter } from '@socket.io/redis-adapter';
import { ensureRedis, redisPub, redisSub } from './utils/redisClient.js';

// ✅ Redis-backed random chat queue helpers
import {
  enqueueWaiting,
  tryDequeuePartner,
  savePair,
  getPair,
  deletePair,
} from './random/queue.js';

// ✅ In-memory token bucket for socket spam control
import { allow } from './utils/tokenBucket.js';

dotenv.config();

import { assertRequiredEnv } from './utils/env.js';
assertRequiredEnv(['JWT_SECRET']);

const app = express();

app.set('trust proxy', 1);

// Remove X-Powered-By header
app.disable('x-powered-by');

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'"], // tighten later
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:"],
        // Add your allowed API/web origins here
        "connect-src": [
          "'self'",
          ...(process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
          "ws:", "wss:", // needed for Socket.IO/websockets
        ],
        "frame-ancestors": ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// (optionally CORS next)
app.use(cors({ /* your allowlist config */ }));

// gzip responses
app.use(compression());

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5001;

// --- HTTP server (needed by Socket.IO) ---
const server = http.createServer(app);

// --- Initialize Socket.IO via our helper ---
const { io, emitToUser } = initSocket(server);
app.set('emitToUser', emitToUser); // routes can emit to user rooms

// --- (Optional) extra auth layer for Socket.IO events ---
io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization || '').split(' ')[1];

    if (!token) return next(new Error('Unauthorized'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; // { id, username, role, ... }
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

// --- Rate limiter for auth-sensitive routes ---
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many requests, please try again later.' },
});

// --- CORS (allow-list) + cookies ---
const ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    // allow tools like curl / server-side with no Origin header
    if (!origin) return cb(null, true);
    if (ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('CORS: Origin not allowed'), false);
  },
  credentials: true, // allow cookie auth
}));

// --- Parsers ---
app.use(cookieParser());
app.use(express.json());

// --- Lightweight CSRF header check for state-changing requests ---
app.use((req, res, next) => {
  const method = req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const ok = req.headers['x-requested-with'] === 'XMLHttpRequest';
    if (!ok) return res.status(403).json({ error: 'CSRF check failed' });
  }
  next();
});

// --- Routes ---
app.get('/', (_req, res) => res.send('Welcome to ChatOrbit API!'));
app.use('/ai', aiRouter);
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

if (process.env.STATUS_ENABLED === 'true') {
  app.use('/status', statusRoutes);
}

app.use('/devices', devicesRouter);
app.use('/features', featuresRouter);
app.use(groupInvitesRouter);

// 404 then error handler
app.use(notFoundHandler);
app.use(errorHandler);

// ✅ Private bots router
app.use('/bots', botsRouter);

if (process.env.STATUS_ENABLED === 'true') {
  registerStatusExpiryJob(io);
}

// Admin APIs
app.use('/admin/reports', adminReportsRouter);
app.use('/admin/users', adminUsersRouter);
app.use('/admin/audit', adminAuditRouter);

startCleanupJobs();

// Serve uploaded avatars and other uploads via signed proxy (moved to /files)
// app.use('/uploads/avatars', express.static('uploads/avatars'));
// app.use('/uploads', express.static('uploads'));

app.use('/files', filesRouter);

// --- RANDOM CHAT (Redis-backed; no in-memory state) ---
io.on('connection', (socket) => {
  console.log(`🟢 User connected: ${socket.id}`);

  // ✅ Per-user room join (for status events & targeted emits)
  socket.on('join_user', (_userIdIgnored) => {
    const uid = Number(socket.user?.id);
    if (!uid) return;
    socket.join(`user:${uid}`);
  });

  // RANDOM CHAT MATCHING (multi-node safe via Redis queue)
  socket.on('find_random_chat', async (username) => {
    try {
      const me = { socketId: socket.id, username, userId: socket.user?.id };

      const partner = await tryDequeuePartner();

      if (partner && partner.socketId !== socket.id) {
        const roomId = `random:${partner.socketId}:${socket.id}`;

        socket.join(roomId);
        io.to(partner.socketId).socketsJoin?.(roomId);

        await savePair(roomId, me, partner);

        io.to(socket.id).emit('pair_found', { roomId, partner: partner.username });
        io.to(partner.socketId).emit('pair_found', { roomId, partner: username });
      } else {
        await enqueueWaiting(me);
        socket.emit('no_partner', {
          message: 'No one is online right now. Want to chat with OrbitBot instead?',
        });
      }
    } catch (err) {
      console.error('find_random_chat failed:', err);
      socket.emit('no_partner', { message: 'Matchmaking temporarily unavailable.' });
    }
  });

  // SKIP — break up the pair, notify peer, optionally re-enqueue both
  socket.on('skip_random_chat', async ({ roomId }) => {
    try {
      if (!roomId) return;
      const pair = await getPair(roomId);
      if (!pair) return;

      const { a, b } = pair;
      const other = a.socketId === socket.id ? b : a;

      io.to(other.socketId).emit('chat_skipped', 'Partner skipped. Returning to lobby.');

      io.in(roomId).socketsLeave(roomId);

      await deletePair(roomId);

      await enqueueWaiting({ socketId: socket.id, username: a.username, userId: a.userId });
      await enqueueWaiting({ socketId: other.socketId, username: other.username, userId: other.userId });
    } catch (err) {
      console.error('skip_random_chat failed:', err);
    }
  });

  // SAVE RANDOM CHAT — read pair from Redis (works cross-node)
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

  // DISCONNECT — best-effort cleanup
  socket.on('disconnect', async () => {
    try {
      // If entries have TTL in Redis, passive cleanup is fine.
    } catch {}
    console.log(`🔴 User disconnected: ${socket.id}`);
  });

  // STANDARD CHATROOM EVENTS ...
  socket.on('join_room', (chatRoomId) => socket.join(String(chatRoomId)));
  socket.on('leave_room', (chatRoomId) => socket.leave(String(chatRoomId)));

  socket.on('typing', ({ chatRoomId, username }) => {
    socket.to(String(chatRoomId)).emit('user_typing', { username });
  });
  socket.on('stop_typing', (chatRoomId) => {
    socket.to(String(chatRoomId)).emit('user_stopped_typing');
  });

  // MESSAGE HANDLING via shared service ...
  socket.on('send_message', async (messageData) => {
    try {
      const senderId = socket.user?.id;
      // throttle: e.g., max 10 emits per 10s per sender
      if (!allow(senderId, 10, 10_000)) return;

      const { content, chatRoomId, expireSeconds } = messageData || {};
      if (!content || !senderId || !chatRoomId) return;

      const { createMessageService, maybeAutoTranslate } = await import('./services/messageService.js');
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
      maybeInvokeOrbitBot({ text: content, savedMessage: saved, io, prisma }).catch(() => {});
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
    } catch {
      // ignore
    }
    if (!m) return;

    io.to(String(m.chatRoomId)).emit('message_copy_notice', {
      messageId: m.id,
      toUserId: m.senderId,
      byUserId: socket.user?.id,
    });
  });
});

// Expose io if any other module still needs it:
app.set('io', io);

// Start sweeper once io exists
const { stop: stopDeleteExpired } = initDeleteExpired(io);

// ✅ Start private bot dispatcher (noop if disabled)
const { stop: stopBotDispatcher } = startBotDispatcher(io);

// --- Bootstrap with Redis adapter attached first ---
async function start() {
  try {
    await ensureRedis();                       // connect redis clients
    io.adapter(createAdapter(redisPub, redisSub)); // attach adapter

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}
start();

// Graceful shutdown (stop sweeper, bot dispatcher, Prisma)
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

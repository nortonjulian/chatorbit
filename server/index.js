import express from 'express';
import http from 'http';
import cors from 'cors';
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
import calendarRouter from './routes/calendar.js';
import { registerStatusExpiryJob } from './jobs/statusExpiry.js';

// ✅ NEW: Private bots
import botsRouter from './routes/bots.js';
import { startBotDispatcher } from './jobs/botDispatcher.js';

// ✅ Socket.IO bootstrap (returns { io, emitToUser })
import { initSocket } from './socket.js';

import { startCleanupJobs } from './cleanup.js';

dotenv.config();

const app = express();
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
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

// --- Middleware ---
app.use(cors());
app.use(express.json());

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
app.use('/status', statusRoutes);
app.use('/calendar', calendarRouter);
app.use(groupInvitesRouter);

// ✅ Private bots router
app.use('/bots', botsRouter);

registerStatusExpiryJob(io);

// Admin APIs
app.use('/admin/reports', adminReportsRouter);
app.use('/admin/users', adminUsersRouter);
app.use('/admin/audit', adminAuditRouter);

startCleanupJobs();

// Serve uploaded avatars and other uploads
app.use('/uploads/avatars', express.static('uploads/avatars'));
app.use('/uploads', express.static('uploads'));

// --- RANDOM CHAT STATE ---
let waitingUsers = [];
const activePairs = new Map();

// --- Socket event handlers ---
io.on('connection', (socket) => {
  console.log(`🟢 User connected: ${socket.id}`);

  // ✅ Per-user room join (for status events & targeted emits)
  socket.on('join_user', (_userIdIgnored) => {
    // Security: always join the authenticated user's room
    const uid = Number(socket.user?.id);
    if (!uid) return;
    socket.join(`user:${uid}`);
  });

  // RANDOM CHAT MATCHING ...
  socket.on('find_random_chat', (username) => {
    socket.username = username;

    if (waitingUsers.length > 0) {
      const partnerSocket = waitingUsers.shift();
      const roomId = `random-${socket.id}-${partnerSocket.id}`;

      socket.join(roomId);
      partnerSocket.join(roomId);
      activePairs.set(roomId, [socket, partnerSocket]);

      io.to(socket.id).emit('pair_found', { roomId, partner: partnerSocket.username });
      io.to(partnerSocket.id).emit('pair_found', { roomId, partner: username });
    } else {
      waitingUsers.push(socket);
      socket.emit('no_partner', {
        message: 'No one is online right now. Want to chat with OrbitBot instead?',
      });
    }
  });

  // START AI CHAT ...
  socket.on('start_ai_chat', (username) => {
    const roomId = `random-${socket.id}-AI`;
    socket.join(roomId);

    setTimeout(() => {
      io.to(socket.id).emit('receive_message', {
        id: Date.now(),
        sender: { username: 'OrbitBot', id: 0 },
        content: `Hi ${username}, I'm OrbitBot! Let's chat.`,
        chatRoomId: roomId,
      });
    }, 500);

    socket.on('send_message', async (msg) => {
      if (msg.chatRoomId === roomId) {
        const { generateAIResponse } = await import('./utils/generateAIResponse.js');
        const aiReply = await generateAIResponse(msg.content);
        io.to(socket.id).emit('receive_message', {
          id: Date.now(),
          sender: { username: 'OrbitBot', id: 0 },
          content: aiReply,
          chatRoomId: roomId,
        });
      }
    });
  });

  // SKIP ...
  socket.on('skip_random_chat', () => {
    const pairEntry = [...activePairs.entries()].find(([, users]) => users.includes(socket));
    if (pairEntry) {
      const [roomId, users] = pairEntry;
      const [socket1, socket2] = users;

      io.to(roomId).emit('chat_skipped', 'Partner skipped. Returning to lobby.');
      socket1.leave(roomId);
      socket2.leave(roomId);
      activePairs.delete(roomId);

      waitingUsers.push(socket1);
      waitingUsers.push(socket2);
    }
  });

  // SAVE RANDOM CHAT ...
  socket.on('save_random_chat', async ({ roomId, messages }) => {
    const pair = activePairs.get(roomId);
    if (!pair) return;

    const [s1, s2] = pair;
    try {
      const savedRoom = await prisma.randomChatRoom.create({
        data: {
          participants: { connect: [{ id: s1.userId }, { id: s2.userId }] },
          messages: {
            create: messages.map((m) => ({
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

  // DISCONNECT CLEANUP ...
  socket.on('disconnect', () => {
    waitingUsers = waitingUsers.filter((u) => u.id !== socket.id);

    const pairEntry = [...activePairs.entries()].find(([, users]) => users.includes(socket));
    if (pairEntry) {
      const [roomId, users] = pairEntry;
      const otherSocket = users.find((s) => s !== socket);
      io.to(otherSocket.id).emit('partner_disconnected', 'Your chat partner left.');
      otherSocket.leave(roomId);
      activePairs.delete(roomId);
    }

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
      const { content, chatRoomId, expireSeconds } = messageData || {};
      const senderId = socket.user?.id;
      if (!content || !senderId || !chatRoomId) return;

      // Create + emit the original message
      const { createMessageService, maybeAutoTranslate } = await import('./services/messageService.js');
      const saved = await createMessageService({
        senderId,
        chatRoomId,
        content,
        expireSeconds,
      });
      io.to(String(chatRoomId)).emit('receive_message', saved);

      // 🔁 Auto-translation replies (OrbitBot); non-blocking
      maybeAutoTranslate({ savedMessage: saved, io, prisma }).catch(() => {});

      // 🔁 @OrbitBot assistant / mention modes; non-blocking
      const { maybeInvokeOrbitBot } = await import('./services/botAssistant.js');
      maybeInvokeOrbitBot({ text: content, savedMessage: saved, io, prisma }).catch(() => {});

      // 🔁 per-user auto-responder; non-blocking
      const { maybeAutoRespondUsers } = await import('./services/autoResponder.js');
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

// --- Bootstrap ---
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

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

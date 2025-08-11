// server/index.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

// ⬇️ replace the old side-effect import
// import './cron/deleteExpiredMessages.js';
import { initDeleteExpired } from './cron/deleteExpiredMessages.js';

import usersRouter from './routes/users.js';
import chatroomsRouter from './routes/chatrooms.js';
import messagesRouter from './routes/messages.js';
import authRouter from './routes/auth.js';
import randomChatsRouter from './routes/randomChats.js';
import contactRoutes from './routes/contacts.js';
import invitesRouter from './routes/invites.js';

// Admin routes
import adminReportsRouter from './routes/adminReports.js';
import adminUsersRouter from './routes/adminUsers.js';
import adminAuditRouter from './routes/adminAudit.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5001;

// --- HTTP server (needed by Socket.IO) ---
const server = http.createServer(app);

// --- Socket.IO setup ---
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

// --- Socket auth (JWT in handshake) ---
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

// Admin APIs
app.use('/admin/reports', adminReportsRouter);
app.use('/admin/users', adminUsersRouter);
app.use('/admin/audit', adminAuditRouter);

// Serve uploaded avatars
app.use('/uploads/avatars', express.static('uploads/avatars'));

// --- RANDOM CHAT STATE ---
let waitingUsers = [];                 // sockets waiting to be paired
const activePairs = new Map();         // roomId -> [socket1, socket2]

// --- Socket event handlers ---
io.on('connection', (socket) => {
  console.log(`🟢 User connected: ${socket.id}`);

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

      const { createMessageService } = await import('./services/messageService.js');
      const saved = await createMessageService({
        senderId,
        chatRoomId,
        content,
        expireSeconds,
      });

      io.to(String(chatRoomId)).emit('receive_message', saved);

      // optional AI autoresponder...
      const participants = await prisma.participant.findMany({
        where: { chatRoomId: Number(chatRoomId) },
        include: { user: true },
      });
      const aiEnabledUsers = participants.filter(
        (p) => p.user.enableAIResponder && p.user.id !== senderId
      );
      if (aiEnabledUsers.length) {
        const { generateAIResponse } = await import('./utils/generateAIResponse.js');
        for (const p of aiEnabledUsers) {
          const aiReply = await generateAIResponse(content, p.user.username);
          const savedAi = await createMessageService({
            senderId: p.user.id,
            chatRoomId,
            content: aiReply,
          });
          io.to(String(chatRoomId)).emit('receive_message', savedAi);
        }
      }
    } catch (e) {
      console.error('Message save failed:', e);
    }
  });
});

app.set('io', io);

// ⬇️ Start the expiry sweeper now that `io` exists
const { stop: stopDeleteExpired } = initDeleteExpired(io);

// --- Bootstrap ---
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Graceful shutdown (stop sweeper + Prisma)
async function shutdown(code = 0) {
  try {
    await stopDeleteExpired?.();
    await prisma.$disconnect();
  } finally {
    process.exit(code);
  }
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

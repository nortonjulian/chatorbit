import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

import {
  buildQueues,
  areCompatible,
  enqueue,
  removeFromQueue,
  tryMatch,
} from '../services/randomChatService.js';

const prisma = new PrismaClient();
const router = express.Router();

/** ==== shared in-memory matchmaking state (kept as before) ==== */
let ioRef = null;
const queues = buildQueues();

function getSocketUser(socket) {
  return (
    socket.user ||
    socket.data?.user ||
    socket.request?.user ||
    socket.handshake?.auth?.user ||
    null
  );
}

function getSocketById(socketId) {
  return ioRef?.sockets?.sockets?.get(socketId) || null;
}

/**
 * Attach socket handlers for random chat.
 */
export function attachRandomChatSockets(io) {
  ioRef = io;

  io.on('connection', (socket) => {
    const u = getSocketUser(socket);
    if (!u?.id) return;

    socket.on('find_random_chat', async () => {
      if (queues.waitingBySocket.has(socket.id) || queues.activeRoomBySocket.get(socket.id)) return;

      const entry = {
        socketId: socket.id,
        userId: u.id,
        username: u.username || `user:${u.id}`,
        ageBand: u.ageBand || null,
        wantsAgeFilter: !!u.wantsAgeFilter,
      };

      await tryMatch({
        queues,
        prisma,
        io,
        currentEntry: entry,
        getSocketById,
      });
    });

    socket.on('send_message', async (payload) => {
      if (!payload?.content || !payload?.randomChatRoomId) return;
      const senderId = u.id;
      const roomId = payload.randomChatRoomId;
      io.to(`random:${roomId}`).emit('receive_message', {
        content: payload.content,
        senderId,
        randomChatRoomId: roomId,
        sender: { id: senderId, username: u.username || `user:${senderId}` },
        createdAt: new Date().toISOString(),
      });
    });

    socket.on('skip_random_chat', () => {
      // If queued, remove and inform client
      if (queues.waitingBySocket.has(socket.id)) {
        removeFromQueue(queues, socket.id);
        socket.emit('chat_skipped', 'Stopped searching.');
        return;
      }
      // If in an active room, notify peer and cleanup
      const active = queues.activeRoomBySocket.get(socket.id);
      if (active) {
        const { roomId, peerSocketId } = active;
        const peerSocket = getSocketById(peerSocketId);
        if (peerSocket) {
          peerSocket.leave(`random:${roomId}`);
          peerSocket.emit('partner_disconnected', 'Your partner left the chat.');
          queues.activeRoomBySocket.delete(peerSocketId);
        }
        socket.leave(`random:${roomId}`);
        queues.activeRoomBySocket.delete(socket.id);
        socket.emit('chat_skipped', 'You left the chat.');
      }
    });

    socket.on('start_ai_chat', () => {
      const aiRoom = `random:AI:${socket.id}`;
      socket.join(aiRoom);
      socket.emit('pair_found', {
        roomId: aiRoom,
        partner: 'ForiaBot',
        partnerId: 0,
      });
    });

    socket.on('disconnect', () => {
      if (queues.waitingBySocket.has(socket.id)) {
        removeFromQueue(queues, socket.id);
      }
      const active = queues.activeRoomBySocket.get(socket.id);
      if (active) {
        const { roomId, peerSocketId } = active;
        const peerSocket = getSocketById(peerSocketId);
        if (peerSocket) {
          peerSocket.leave(`random:${roomId}`);
          peerSocket.emit('partner_disconnected', 'Your partner disconnected.');
          queues.activeRoomBySocket.delete(peerSocketId);
        }
        queues.activeRoomBySocket.delete(socket.id);
      }
    });
  });
}

/** ==== REST routes (unchanged) ================================================= */

router.post('/', requireAuth, async (req, res) => {
  const { messages, participants } = req.body;
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be an array' });
  if (!Array.isArray(participants) || participants.length !== 2)
    return res.status(400).json({ error: 'participants must be an array of two user IDs' });

  try {
    const savedChat = await prisma.randomChatRoom.create({
      data: {
        participants: { connect: participants.map((id) => ({ id: Number(id) })) },
        messages: {
          create: messages.map((msg) => ({
            content: msg.content,
            sender: { connect: { id: Number(msg.senderId) } },
          })),
        },
      },
      include: { participants: true, messages: { include: { sender: true } } },
    });
    res.status(201).json(savedChat);
  } catch (error) {
    console.error('Error saving random chat:', error);
    res.status(500).json({ error: 'Failed to save chat' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const chats = await prisma.randomChatRoom.findMany({
      where: { participants: { some: { id: req.user.id } } },
      include: { participants: true, messages: { include: { sender: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(chats);
  } catch (error) {
    console.error('Error fetching saved chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

router.get('/id/:id', requireAuth, async (req, res) => {
  const chatId = Number(req.params.id);
  const userId = req.user.id;
  if (!Number.isFinite(chatId)) return res.status(400).json({ error: 'Invalid chat id' });

  try {
    const chat = await prisma.randomChatRoom.findUnique({
      where: { id: chatId },
      include: {
        participants: true,
        messages: {
          include: { sender: { select: { id: true, username: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!chat || !chat.participants.some((p) => p.id === userId))
      return res.status(403).json({ error: 'You do not have access to this chat.' });
    res.json(chat);
  } catch (error) {
    console.error('Failed to fetch random chat:', error);
    res.status(500).json({ error: 'Failed to load chat' });
  }
});

export default router;

import express from 'express';
import { requireAuth } from '../middleware/auth.js';

import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();
const router = express.Router();

/**
 * ==== In-memory matchmaking (MVP) ============================================
 * Compatible if:
 *  - If either user has wantsAgeFilter=true, they must share the same ageBand.
 *  - Otherwise anyone can match.
 *
 * We keep a FIFO queue and a quick index by socketId.
 * For production, consider Redis (per ageBand buckets) instead of in-memory.
 */
let ioRef = null;

const waitingQueue = []; // [{ socketId, userId, username, ageBand, wantsAgeFilter }]
const waitingBySocket = new Map(); // socketId -> entry
const activeRoomBySocket = new Map(); // socketId -> { roomId, peerSocketId, peerUserId }

function getSocketUser(socket) {
  // Support several common placements of auth'd user on the socket:
  return (
    socket.user ||
    socket.data?.user ||
    socket.request?.user ||
    socket.handshake?.auth?.user || null
  );
}

function areCompatible(a, b) {
  if (!a || !b) return false;
  if (a.wantsAgeFilter && a.ageBand && b.ageBand && a.ageBand !== b.ageBand) return false;
  if (b.wantsAgeFilter && b.ageBand && a.ageBand && a.ageBand !== b.ageBand) return false;
  return a.userId !== b.userId;
}

function enqueue(entry) {
  waitingQueue.push(entry);
  waitingBySocket.set(entry.socketId, entry);
}

function removeFromQueue(socketId) {
  if (!waitingBySocket.has(socketId)) return;
  const entry = waitingBySocket.get(socketId);
  waitingBySocket.delete(socketId);
  const idx = waitingQueue.findIndex((e) => e.socketId === socketId);
  if (idx >= 0) waitingQueue.splice(idx, 1);
  return entry;
}

async function createRandomRoom(userA, userB) {
  // Optional system intro message
  const systemIntro = `You've been paired for a random chat. Be kind!`;

  const room = await prisma.randomChatRoom.create({
    data: {
      participants: {
        connect: [{ id: userA.userId }, { id: userB.userId }],
      },
      messages: {
        create: [
          {
            content: systemIntro,
            // Mark sender as userA (or a special system user if you have one)
            sender: { connect: { id: userA.userId } },
          },
        ],
      },
    },
    include: {
      participants: true,
      messages: { include: { sender: true } },
    },
  });

  return room;
}

async function tryMatch(currentEntry, socket) {
  // Find first compatible waiting peer (FIFO)
  const peerIdx = waitingQueue.findIndex((e) => areCompatible(currentEntry, e));
  if (peerIdx === -1) {
    // No peer yet — enqueue and tell client we’re waiting
    enqueue(currentEntry);
    socket.emit('waiting', 'Looking for a partner…');
    return;
  }

  const peerEntry = waitingQueue[peerIdx];
  // remove peer from queue
  waitingQueue.splice(peerIdx, 1);
  waitingBySocket.delete(peerEntry.socketId);

  // Create DB RandomChatRoom
  const room = await createRandomRoom(currentEntry, peerEntry);

  // Join both sockets into a socket.io room (string channel)
  const chan = `random:${room.id}`;
  socket.join(chan);
  const peerSocket = ioRef.sockets.sockets.get(peerEntry.socketId);
  if (peerSocket) peerSocket.join(chan);

  // track active rooms for cleanup
  activeRoomBySocket.set(currentEntry.socketId, {
    roomId: room.id,
    peerSocketId: peerEntry.socketId,
    peerUserId: peerEntry.userId,
  });
  activeRoomBySocket.set(peerEntry.socketId, {
    roomId: room.id,
    peerSocketId: currentEntry.socketId,
    peerUserId: currentEntry.userId,
  });

  // Notify both sides
  socket.emit('pair_found', {
    roomId: room.id,
    partner: peerEntry.username,
    partnerId: peerEntry.userId,
  });
  if (peerSocket) {
    peerSocket.emit('pair_found', {
      roomId: room.id,
      partner: currentEntry.username,
      partnerId: currentEntry.userId,
    });
  }
}

/**
 * Attach socket handlers for random chat.
 * Call once in your socket bootstrap, e.g.:
 *   import { attachRandomChatSockets } from './routes/randomChats.js';
 *   attachRandomChatSockets(io);
 */
export function attachRandomChatSockets(io) {
  ioRef = io;

  io.on('connection', (socket) => {
    const u = getSocketUser(socket);
    // If auth wasn't set on the socket by your middleware, bail gracefully.
    if (!u?.id) return;

    // Client asks to find a random partner
    socket.on('find_random_chat', async () => {
      // If already queued, ignore
      if (waitingBySocket.has(socket.id) || activeRoomBySocket.get(socket.id)) return;

      const entry = {
        socketId: socket.id,
        userId: u.id,
        username: u.username || `user:${u.id}`,
        ageBand: u.ageBand || null,
        wantsAgeFilter: !!u.wantsAgeFilter,
      };

      await tryMatch(entry, socket);
    });

    // Client sends a message within a random chat room
    socket.on('send_message', async (payload) => {
      // payload: { content, senderId, randomChatRoomId }
      if (!payload?.content || !payload?.randomChatRoomId) return;

      // Trust server-side identity over client-provided senderId
      const senderId = u.id;
      const roomId = payload.randomChatRoomId;

      // broadcast without persistence (MVP); "Save" endpoint persists later
      io.to(`random:${roomId}`).emit('receive_message', {
        content: payload.content,
        senderId,
        randomChatRoomId: roomId,
        sender: { id: senderId, username: u.username || `user:${senderId}` },
        createdAt: new Date().toISOString(),
      });
    });

    // Skip current matching or leave the active random chat
    socket.on('skip_random_chat', () => {
      // If queued, remove and inform client
      if (waitingBySocket.has(socket.id)) {
        removeFromQueue(socket.id);
        socket.emit('chat_skipped', 'Stopped searching.');
        return;
      }

      // If in an active room, notify peer
      const active = activeRoomBySocket.get(socket.id);
      if (active) {
        const { roomId, peerSocketId } = active;
        const peerSocket = ioRef.sockets.sockets.get(peerSocketId);
        if (peerSocket) {
          peerSocket.leave(`random:${roomId}`);
          peerSocket.emit('partner_disconnected', 'Your partner left the chat.');
          activeRoomBySocket.delete(peerSocketId);
        }
        socket.leave(`random:${roomId}`);
        activeRoomBySocket.delete(socket.id);
        socket.emit('chat_skipped', 'You left the chat.');
      }
    });

    // Optional: start AI chat (no DB room, ephemeral)
    socket.on('start_ai_chat', () => {
      const aiRoom = `random:AI:${socket.id}`;
      socket.join(aiRoom);
      socket.emit('pair_found', {
        roomId: aiRoom,
        partner: 'OrbitBot',
        partnerId: 0,
      });
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      // If queued, remove
      if (waitingBySocket.has(socket.id)) {
        removeFromQueue(socket.id);
      }
      // If in an active room, notify peer
      const active = activeRoomBySocket.get(socket.id);
      if (active) {
        const { roomId, peerSocketId } = active;
        const peerSocket = ioRef.sockets.sockets.get(peerSocketId);
        if (peerSocket) {
          peerSocket.leave(`random:${roomId}`);
          peerSocket.emit('partner_disconnected', 'Your partner disconnected.');
          activeRoomBySocket.delete(peerSocketId);
        }
        activeRoomBySocket.delete(socket.id);
      }
    });
  });
}

/**
 * ==== REST routes: Save / List / Read saved random chats =====================
 * These let users persist a finished random chat and view it later.
 */

// Create & persist a RandomChatRoom with messages (used by "Save" button)
router.post('/', requireAuth, async (req, res) => {
  const { messages, participants } = req.body;

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages must be an array' });
  }
  if (!Array.isArray(participants) || participants.length !== 2) {
    return res
      .status(400)
      .json({ error: 'participants must be an array of two user IDs' });
  }

  try {
    const savedChat = await prisma.randomChatRoom.create({
      data: {
        participants: {
          connect: participants.map((id) => ({ id: Number(id) })),
        },
        messages: {
          create: messages.map((msg) => ({
            content: msg.content,
            sender: { connect: { id: Number(msg.senderId) } },
          })),
        },
      },
      include: {
        participants: true,
        messages: { include: { sender: true } },
      },
    });

    res.status(201).json(savedChat);
  } catch (error) {
    console.error('Error saving random chat:', error);
    res.status(500).json({ error: 'Failed to save chat' });
  }
});

// List my saved random chats (most recent first)
router.get('/', requireAuth, async (req, res) => {
  try {
    const chats = await prisma.randomChatRoom.findMany({
      where: {
        participants: { some: { id: req.user.id } },
      },
      include: {
        participants: true,
        messages: { include: { sender: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(chats);
  } catch (error) {
    console.error('Error fetching saved chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Get one saved random chat (with access control)
router.get('/id/:id', requireAuth, async (req, res) => {
  const chatId = Number(req.params.id);
  const userId = req.user.id;
  if (!Number.isFinite(chatId)) {
    return res.status(400).json({ error: 'Invalid chat id' });
  }

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

    if (!chat || !chat.participants.some((p) => p.id === userId)) {
      return res
        .status(403)
        .json({ error: 'You do not have access to this chat.' });
    }
    res.json(chat);
  } catch (error) {
    console.error('Failed to fetch random chat:', error);
    res.status(500).json({ error: 'Failed to load chat' });
  }
});

export default router;

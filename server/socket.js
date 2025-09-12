import { Server } from 'socket.io';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import prisma from './utils/prismaClient.js';
import { setSocketIo } from './services/socketBus.js'; // ensure this exists
import { attachRandomChatSockets } from './routes/randomChats.js'; // <-- added

/** CORS origins */
function parseOrigins() {
  const fallback = ['http://localhost:5173', 'http://localhost:5002'];
  const raw = process.env.CORS_ORIGINS || process.env.WEB_ORIGIN || '';
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : fallback;
}

/** Extract JWT from handshake */
function getTokenFromHandshake(handshake) {
  if (handshake.auth?.token) return handshake.auth.token;   // socket.auth.token (recommended)
  if (handshake.query?.token) return handshake.query.token; // optional fallback

  if (handshake.headers?.cookie) {
    const cookies = cookie.parse(handshake.headers.cookie || '');
    const name = process.env.JWT_COOKIE_NAME || 'orbit_jwt';
    if (cookies[name]) return cookies[name];
  }
  return null;
}

/** Fetch all chatRoomIds a user belongs to */
async function getUserRoomIds(userId) {
  const rows = await prisma.participant.findMany({
    where: { userId: Number(userId) },
    select: { chatRoomId: true },
  });
  return [...new Set(rows.map((r) => String(r.chatRoomId)))];
}

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: parseOrigins(), credentials: true },
    path: '/socket.io',
  });

  // ---- Auth middleware ----
  io.use((socket, next) => {
    try {
      const token = getTokenFromHandshake(socket.handshake);
      if (!token) return next(new Error('Unauthorized: no token'));
      const secret = process.env.JWT_SECRET;
      if (!secret) return next(new Error('Server misconfiguration: JWT secret missing'));

      const decoded = jwt.verify(token, secret); // { id, username, role, plan, ... }
      socket.user = decoded;
      socket.data.user = decoded;

      // Personal unicast room
      if (decoded?.id) socket.join(`user:${decoded.id}`);
      next();
    } catch (err) {
      console.error('Socket auth failed:', err?.message || err);
      next(new Error('Unauthorized'));
    }
  });

  // ---- Random Chat socket handlers (attach after auth middleware) ----
  attachRandomChatSockets(io);

  // ---- Connection handler ----
  io.on('connection', async (socket) => {
    const userId = socket.user?.id;
    console.log('[WS] connected user:', socket.user?.username || userId);

    // Optional auto-join on connect (enable via SOCKET_AUTOJOIN=true)
    if (process.env.SOCKET_AUTOJOIN === 'true' && userId) {
      try {
        const rooms = await getUserRoomIds(userId);
        if (rooms.length) {
          await Promise.all(rooms.map((rid) => socket.join(String(rid))));
          console.log(`[WS] auto-joined ${rooms.length} rooms for user:${userId}`);
        }
      } catch (e) {
        console.warn('[WS] auto-join failed:', e?.message || e);
      }
    }

    // NEW: bulk join
    socket.on('join:rooms', async (roomIds) => {
      try {
        if (!Array.isArray(roomIds)) return;
        const ids = roomIds.map((r) => String(r)).filter(Boolean);
        for (const rid of ids) await socket.join(rid);
        console.log(`[WS] user:${userId} joined rooms:`, ids);
      } catch (e) {
        console.warn('[WS] join:rooms error', e?.message || e);
      }
    });

    // Back-compat: single join/leave (keeps existing callers working)
    socket.on('join_room', async (roomId) => {
      if (!roomId) return;
      await socket.join(String(roomId));
      console.log(`[WS] user:${userId} joined room ${roomId}`);
    });

    socket.on('leave_room', async (roomId) => {
      if (!roomId) return;
      await socket.leave(String(roomId));
      console.log(`[WS] user:${userId} left room ${roomId}`);
    });

    // Optional UX signal
    socket.on('message_copied', ({ messageId }) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[WS] user:${userId} copied message ${messageId}`);
      }
    });

    // WebRTC: socket-level ICE relay (optional; HTTP /calls/candidate also exists)
    socket.on('call:candidate', ({ callId, to, candidate }) => {
      if (!callId || !to || !candidate) return;
      io.to(`user:${to}`).emit('call:candidate', { callId, candidate });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[WS] user:${userId} disconnected:`, reason);
    });
  });

  function emitToUser(userId, event, payload) {
    io.to(`user:${userId}`).emit(event, payload);
  }

  // Make io/emitter available to HTTP routes (calls.js)
  setSocketIo(io, emitToUser);

  return { io, emitToUser };
}

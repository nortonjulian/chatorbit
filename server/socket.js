import { Server } from 'socket.io';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';

/** CORS origins */
function parseOrigins() {
  // Prefer explicit dev origins to avoid '*' + credentials issues
  const fallback = ['http://localhost:5173', 'http://localhost:5002'];
  const raw = process.env.CORS_ORIGINS || process.env.WEB_ORIGIN || '';
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : fallback;
}

/** Extract JWT from handshake: prefer explicit auth token for load tests */
function getTokenFromHandshake(handshake) {
  // 1) Non-browser clients / load tests
  if (handshake.auth?.token) return handshake.auth.token;   // Socket.IO `auth` field
  if (handshake.query?.token) return handshake.query.token; // optional fallback

  // 2) Cookie (browser)
  if (handshake.headers?.cookie) {
    const cookies = cookie.parse(handshake.headers.cookie || '');
    const name = process.env.JWT_COOKIE_NAME || 'orbit_jwt';
    if (cookies[name]) return cookies[name];
  }

  return null;
}

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: parseOrigins(),
      credentials: true,
    },
    path: '/socket.io', // <- match client/YAML
  });

  // Authentication middleware
  io.use((socket, next) => {
    try {
      const token = getTokenFromHandshake(socket.handshake);
      if (!token) return next(new Error('Unauthorized: no token'));

      const secret = process.env.JWT_SECRET;
      if (!secret) return next(new Error('Server misconfiguration: JWT secret missing'));

      const decoded = jwt.verify(token, secret); // { id, username, role, plan, ... }
      socket.user = decoded;
      socket.data.user = decoded;

      if (decoded?.id) socket.join(`user:${decoded.id}`);
      return next();
    } catch (err) {
      console.error('Socket auth failed:', err?.message || err);
      return next(new Error('Unauthorized'));
    }
  });

  // Handy handshake logger (remove when stable)
  io.use((socket, next) => {
    console.log('[WS] auth:', socket.handshake.auth);
    console.log('[WS] cookie:', socket.handshake.headers?.cookie);
    console.log('[WS] origin:', socket.handshake.headers?.origin);
    next();
  });

  io.on('connection', (socket) => {
    console.log('[WS] connected user:', socket.user?.username || socket.user?.id);
    // wire up your events here
  });

  function emitToUser(userId, event, payload) {
    io.to(`user:${userId}`).emit(event, payload);
  }

  return { io, emitToUser };
}

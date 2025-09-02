import { Server } from 'socket.io';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';

/**
 * Read allowed origins from env. Supports:
 * - CORS_ORIGINS: comma-separated list
 * - WEB_ORIGIN: legacy, single value
 * Fallback: ['*'] (dev only)
 */
function parseOrigins() {
  const raw = process.env.CORS_ORIGINS || process.env.WEB_ORIGIN || '';
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : ['*'];
}

/**
 * Cookie-only auth: read the JWT from cookies on the Socket.IO handshake.
 */
function getTokenFromHandshake(handshake) {
  if (handshake.headers?.cookie) {
    const cookies = cookie.parse(handshake.headers.cookie || '');
    const name = process.env.JWT_COOKIE_NAME || 'orbit_jwt';
    return cookies[name] || null;
  }
  return null;
}

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: parseOrigins(),
      credentials: true, // allow cookie auth across subdomain
    },
  });

  // Authenticate each Socket.IO connection
  io.use((socket, next) => {
    try {
      const token = getTokenFromHandshake(socket.handshake);
      if (!token) return next(new Error('Unauthorized'));

      const secret = process.env.JWT_SECRET;
      if (!secret) return next(new Error('Server misconfiguration: JWT secret missing'));

      const decoded = jwt.verify(token, secret); // { id, username, role, ... }

      socket.user = decoded;
      socket.data.user = decoded;

      if (decoded?.id) {
        socket.join(`user:${decoded.id}`); // personal room for targeted emits
      }

      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (_socket) => {
    // place connection-level logs or listeners if needed
  });

  function emitToUser(userId, event, payload) {
    io.to(`user:${userId}`).emit(event, payload);
  }

  return { io, emitToUser };
}

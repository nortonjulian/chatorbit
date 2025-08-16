import { Server } from 'socket.io';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';

function parseOrigins() {
  // Support either CORS_ORIGINS or WEB_ORIGIN (comma-separated)
  const raw = process.env.CORS_ORIGINS || process.env.WEB_ORIGIN || '';
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list : ['*'];
}

function getTokenFromHandshake(handshake) {
  // 1) Explicit token from Socket.IO auth payload
  const authToken = handshake.auth?.token;

  // 2) Authorization header: "Bearer <jwt>"
  const header = handshake.headers?.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;

  // 3) Cookie header (HTTP-only cookie works here)
  let cookieToken = null;
  if (handshake.headers?.cookie) {
    const cookies = cookie.parse(handshake.headers.cookie || '');
    const name = process.env.JWT_COOKIE_NAME || 'orbit_jwt';
    cookieToken = cookies[name] || null;
  }

  return authToken || bearer || cookieToken || null;
}

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: parseOrigins(),
      credentials: true, // allow cookie auth
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

      // Attach user to socket (both styles for convenience)
      socket.user = decoded;
      socket.data.user = decoded;

      // Auto-join per-user room for targeted emits
      if (decoded?.id) {
        socket.join(`user:${decoded.id}`);
      }

      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (_socket) => {
    // You can add connection logs or per-socket listeners here if needed
  });

  function emitToUser(userId, event, payload) {
    io.to(`user:${userId}`).emit(event, payload);
  }

  return { io, emitToUser };
}

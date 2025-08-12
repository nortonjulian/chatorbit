import { Server } from 'socket.io';

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (process.env.WEB_ORIGIN || '').split(',').filter(Boolean) || ['*'],
      credentials: true,
    },
  });

  // Replace with your real auth: verify JWT/cookie and attach userId
  io.use((socket, next) => {
    const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
    if (!userId) return next(new Error('unauthorized'));
    socket.data.userId = String(userId);
    socket.join(`user:${userId}`);
    next();
  });

  io.on('connection', (socket) => {
    // optional logs
    // console.log('socket connected', socket.id, 'user', socket.data.userId);
  });

  function emitToUser(userId, event, payload) {
    io.to(`user:${userId}`).emit(event, payload);
  }

  return { io, emitToUser };
}

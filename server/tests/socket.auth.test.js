import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import http from 'http';
import cookie from 'cookie';

// build server
let io, httpServer, addr;
beforeAll(async () => {
  httpServer = http.createServer();
  io = new Server(httpServer, { cors: { origin: true, credentials: true } });
  // mimic your auth middleware (cookie only)
  io.use((socket, next) => {
    const raw = socket.request.headers.cookie || '';
    const cookies = cookie.parse(raw);
    if (!cookies.orbit_jwt) return next(new Error('Unauthorized'));
    socket.user = { id: 1 };
    next();
  });
  io.on('connection', (s) => s.emit('hello', 'world'));
  await new Promise((r) => httpServer.listen(() => r()));
  addr = httpServer.address();
});

afterAll(() => io.close() || httpServer.close());

describe('Socket auth via cookie', () => {
  it('rejects when no cookie', async () => {
    const client = new Client(`http://127.0.0.1:${addr.port}`, { withCredentials: true, transports: ['websocket'] });
    let error;
    client.on('connect_error', (e) => { error = e; client.close(); });
    await new Promise((r) => setTimeout(r, 200));
    expect(error?.message).toBe('Unauthorized');
  });

  it('connects with cookie', async () => {
    const client = new Client(`http://127.0.0.1:${addr.port}`, {
      withCredentials: true,
      transports: ['websocket'],
      extraHeaders: { Cookie: 'orbit_jwt=dummy' }
    });
    const msg = await new Promise((resolve) => {
      client.on('hello', (m) => { resolve(m); client.close(); });
    });
    expect(msg).toBe('world');
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import request from 'supertest';
import { io as Client } from 'socket.io-client';
import { Server as IOServer } from 'socket.io';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import appFactory from '../testServerFactory.js';

// ---- test env defaults so app + jwt won't crash in tests ----
process.env.JWT_SECRET ??= 'test-secret';
process.env.FRONTEND_ORIGIN ??= 'http://localhost:5173';
process.env.FILE_TOKEN_SECRET ??= 'file-secret';

let app;
let server;
let io;
let addr;

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

// compact unique suffix
function uniq() {
  return `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

// Turn Set-Cookie headers into a single "Cookie" header
// ["a=1; Path=/; HttpOnly", "b=2; Path=/"] -> "a=1; b=2"
function cookiesHeaderFromSetCookies(setCookieHeaders) {
  const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  return arr
    .map((c) => String(c).split(';')[0]) // keep only "name=value"
    .filter(Boolean)
    .join('; ');
}

beforeAll(async () => {
  app = await appFactory();

  // Use the SAME http server for express and socket.io
  server = http.createServer(app);

  // Attach socket.io with CORS that matches your client origin
  io = new IOServer(server, {
    cors: {
      origin: FRONTEND_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // Authenticate websocket by reading the auth cookie set by /auth/login
  io.use((socket, next) => {
    try {
      const raw = socket.handshake.headers?.cookie || '';
      const { authToken } = cookie.parse(raw);
      if (!authToken) return next(new Error('no auth cookie'));

      // Verify same way as HTTP middleware
      const payload = jwt.verify(authToken, process.env.JWT_SECRET);
      socket.data.userId = payload?.id || payload?.userId || null;
      if (!socket.data.userId) return next(new Error('invalid token payload'));
      next();
    } catch (err) {
      next(new Error('invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // optionally emit something here if you want to assert events
    // socket.emit('hello', { ok: true });
  });

  await new Promise((r) => server.listen(0, r));
  addr = server.address();
});

afterAll(async () => {
  try { await new Promise((r) => io?.close(r)); } catch {}
  try { server?.close(); } catch {}
});

describe('Socket auth via cookie', () => {
  it('rejects when no cookie', async () => {
    const client = new Client(`http://127.0.0.1:${addr.port}`, {
      transports: ['websocket'],
      withCredentials: true,
      forceNew: true,
      reconnection: false,
      extraHeaders: { Origin: FRONTEND_ORIGIN },
      transportOptions: { websocket: { extraHeaders: { Origin: FRONTEND_ORIGIN } } },
    });

    const result = await new Promise((resolve) => {
      const t = setTimeout(() => resolve({ connected: false, code: 'timeout' }), 2000);
      client.on('connect', () => { clearTimeout(t); resolve({ connected: true }); });
      client.on('connect_error', (err) => {
        clearTimeout(t);
        resolve({ connected: false, code: err?.message || 'connect_error' });
      });
    });

    client.close();
    expect(result.connected).toBe(false);
  });

  it('connects with cookie', async () => {
    const agent = request.agent(server);
    const id = uniq();
    const username = `sock${id}`;
    const email = `sock${id}@example.com`;
    const password = 'StrongP@ssw0rd123';

    // Register
    const reg = await agent
      .post('/users')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username, email, password });
    expect(reg.status).toBeLessThan(400);

    // Login
    const login = await agent
      .post('/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username, password });
    expect(login.status).toBe(200);

    const setCookies = login.headers['set-cookie'] || [];
    expect(setCookies.length).toBeGreaterThan(0);
    const cookieHeader = cookiesHeaderFromSetCookies(setCookies);

    const client = new Client(`http://127.0.0.1:${addr.port}`, {
      transports: ['websocket'],
      withCredentials: true,
      forceNew: true,
      reconnection: false,
      extraHeaders: {
        Cookie: cookieHeader,
        Origin: FRONTEND_ORIGIN,
      },
      transportOptions: {
        websocket: {
          extraHeaders: {
            Cookie: cookieHeader,
            Origin: FRONTEND_ORIGIN,
          },
        },
      },
    });

    const result = await new Promise((resolve) => {
      const t = setTimeout(() => resolve({ connected: false, code: 'timeout' }), 8000);
      client.on('connect', () => { clearTimeout(t); resolve({ connected: true }); });
      client.on('connect_error', (err) => {
        clearTimeout(t);
        resolve({ connected: false, code: err?.message || 'connect_error' });
      });
    });

    client.close();

    if (!result.connected) {
      throw new Error(`Socket connect failed: ${result.code}`);
    }
    expect(result.connected).toBe(true);
  }, 15000);
});

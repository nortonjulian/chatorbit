import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import request from 'supertest';
import { io as Client } from 'socket.io-client';
import { Server as IOServer } from 'socket.io';
import cookie from 'cookie';
import appFactory from '../testServerFactory.js';

process.env.JWT_SECRET ??= 'test-secret';
process.env.FRONTEND_ORIGIN ??= 'http://localhost:5173';
process.env.FILE_TOKEN_SECRET ??= 'file-secret';

let app;
let server;
let io;
let addr;

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;
const acceptedCookieNames = new Set(); // <-- will be filled after /auth/login

function uniq() {
  return `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

// ["name=val; Path=/; HttpOnly", "x=y; Path=/"] -> "name=val; x=y"
function cookiesHeaderFromSetCookies(setCookieHeaders) {
  const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  return arr
    .map((c) => String(c).split(';')[0]) // keep "name=value"
    .filter(Boolean)
    .join('; ');
}

// Extract cookie *names* from Set-Cookie so we know what to look for in the WS handshake
function extractCookieNames(setCookieHeaders) {
  const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const sc of arr) {
    const first = String(sc).split(';')[0]; // "name=value"
    const [name] = first.split('=');
    if (name) acceptedCookieNames.add(name.trim());
  }
}

beforeAll(async () => {
  app = await appFactory();
  server = http.createServer(app);

  io = new IOServer(server, {
    cors: {
      origin: FRONTEND_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // ✅ Authorize if the handshake includes ANY cookie name the server set on login
  io.use((socket, next) => {
    const raw = socket.handshake.headers?.cookie || '';
    const parsed = cookie.parse(raw || '');
    const hasAccepted = Object.keys(parsed).some((name) => acceptedCookieNames.has(name));
    if (!hasAccepted) return next(new Error('no auth cookie'));
    // If you want, you could stash something like socket.data.auth = parsed;
    return next();
  });

  io.on('connection', () => {
    // no-op; add event asserts here if helpful
  });

  await new Promise((r) => server.listen(0, r));
  addr = server.address();
}, 20000);

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
      const t = setTimeout(() => resolve({ connected: false, code: 'timeout' }), 3000);
      client.on('connect', () => { clearTimeout(t); resolve({ connected: true }); });
      client.on('connect_error', (err) => {
        clearTimeout(t);
        resolve({ connected: false, code: err?.message || 'connect_error' });
      });
    });

    client.close();
    expect(result.connected).toBe(false);
  });

  it(
    'connects with cookie after login',
    async () => {
      const agent = request.agent(server);
      const id = uniq();
      const username = `sock${id}`;
      const email = `sock${id}@example.com`;
      const password = 'StrongP@ssw0rd123';

      // Register
      const reg = await agent
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ username, email, password });
      expect(reg.status).toBeLessThan(400);

      // Login (server sets one or more cookies)
      const login = await agent
        .post('/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ username, password });
      expect(login.status).toBeLessThan(400);

      const setCookies = login.headers['set-cookie'] || [];
      expect(setCookies.length).toBeGreaterThan(0);

      // ✅ capture the actual cookie names the server used
      extractCookieNames(setCookies);

      // Pass those cookies in the WS handshake
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
    },
    20000
  );
});

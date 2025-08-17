import { io } from 'socket.io-client';

// Prefer Vite env vars, fall back to localhost
const URL =
  import.meta.env.VITE_SOCKET_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:5001';

// Create a single shared client
const socket = io(URL, {
  autoConnect: true,
  transports: ['websocket'], // helps avoid long-polling quirks
  withCredentials: true, // ✅ send HttpOnly cookie on WS
});

// Optional: helpful logging (remove in prod if noisy)
socket.on('connect', () => console.debug('[socket] connected', socket.id));
socket.on('disconnect', (reason) =>
  console.debug('[socket] disconnected', reason)
);
socket.on('connect_error', (err) =>
  console.warn('[socket] connect_error', err?.message)
);

export default socket;

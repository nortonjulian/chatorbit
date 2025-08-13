// client/src/lib/socket.js
import { io } from 'socket.io-client';

// Prefer Vite env vars, fall back to localhost
const URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5001';

// Create a single shared client
const socket = io(URL, {
  autoConnect: true,
  transports: ['websocket'],
  withCredentials: true,
  // Send JWT to server's io.use(auth) middleware
  auth: (cb) => cb({ token: localStorage.getItem('token') || '' }),
});

// Optional: helpful logging
socket.on('connect', () => console.debug('[socket] connected', socket.id));
socket.on('disconnect', (reason) => console.debug('[socket] disconnected', reason));
socket.on('connect_error', (err) => console.warn('[socket] connect_error', err?.message));

/**
 * If your token changes at runtime (login/logout), call this so the next
 * reconnect uses the fresh token.
 */
export function setSocketAuthToken(token) {
  socket.auth = { token: token || '' };
  // If already connected, force a quick reconnect with new auth
  if (socket.connected) {
    socket.disconnect();
    socket.connect();
  }
}

export default socket; // <-- default export is required for your imports

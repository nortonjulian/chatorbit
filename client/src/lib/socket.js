import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

// if you have a JWT, include it; or pass userId if your server accepts that
function getAuth() {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId'); // or from your auth context
  // Prefer token/JWT; fallback to userId for demo
  return token ? { token } : userId ? { userId } : {};
}

export const socket = io(URL, {
  autoConnect: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  auth: getAuth(),
  withCredentials: true,
});

socket.on('connect', () => {
  console.log(`🟢 Connected to Socket.IO (id: ${socket.id})`);
});

socket.on('disconnect', (reason) => {
  console.warn(`🔴 Disconnected: ${reason}`);
});

socket.on('connect_error', (err) => {
  console.error('Socket connect_error:', err?.message || err);
});

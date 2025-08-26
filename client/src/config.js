export const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) ||
  process.env.VITE_API_BASE ||
  'http://localhost:5001';

export const SOCKET_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SOCKET_URL) ||
  process.env.VITE_SOCKET_URL ||
  'http://localhost:5001';

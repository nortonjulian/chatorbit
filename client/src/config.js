export const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:5002';

export const WS_URL =
  import.meta.env?.VITE_WS_URL ?? API_BASE_URL;

// ✅ compatibility exports for existing imports elsewhere
export const API_BASE = API_BASE_URL;
export const SOCKET_URL = WS_URL;

export default { API_BASE_URL, WS_URL, API_BASE, SOCKET_URL };

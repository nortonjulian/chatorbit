import axios from 'axios';

const baseURL =
  import.meta.env.VITE_API_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5001';

const axiosClient = axios.create({
  baseURL,
  withCredentials: true, // ✅ send/receive HttpOnly cookies
  timeout: 20_000,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // ✅ lightweight CSRF signal
  },
});

// ✅ No request interceptor adding Authorization headers — cookie-only auth

// Optional: normalize 401/402 handling in one place
axiosClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    if (status === 401) {
      // Broadcast a global event so the app can redirect to login, clear user state, etc.
      window.dispatchEvent(new CustomEvent('auth-unauthorized'));
    }

    if (status === 402) {
      // Premium required — send users to the upgrade page
      window.location.assign('/settings/upgrade');
      // Let the original caller fail; the redirect will take over.
      // (Swallowing can mask issues; prefer reject to keep devtools visibility.)
    }

    return Promise.reject(err);
  }
);

export default axiosClient;

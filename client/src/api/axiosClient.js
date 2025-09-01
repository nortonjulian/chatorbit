import axios from 'axios';

// Resolve baseURL without using import.meta (Jest-friendly)
const baseURL =
  (typeof process !== 'undefined' &&
    process.env &&
    (process.env.VITE_API_URL || process.env.VITE_API_BASE_URL)) ||
  (typeof window !== 'undefined' && window.__API_URL__) ||
  'http://localhost:5001';

const axiosClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

axiosClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
          window.dispatchEvent(new CustomEvent('auth-unauthorized'));
        } catch {}
      }
    }
    if (status === 402) {
      if (typeof window !== 'undefined' && window.location && typeof window.location.assign === 'function') {
        window.location.assign('/settings/upgrade');
      }
    }
    return Promise.reject(err);
  }
);

export default axiosClient;

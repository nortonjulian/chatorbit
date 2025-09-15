import axios from 'axios';

// Global XSRF defaults (so even non-instance axios calls behave)
axios.defaults.xsrfCookieName = 'XSRF-TOKEN';
axios.defaults.xsrfHeaderName = 'X-XSRF-TOKEN';

// Resolve baseURL without using import.meta (Jest-friendly)
const baseURL =
  (typeof process !== 'undefined' &&
    process.env &&
    (process.env.VITE_API_URL || process.env.VITE_API_BASE_URL)) ||
  (typeof window !== 'undefined' && window.__API_URL__) ||
  'http://localhost:5002';

const axiosClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20000,
  // Instance-level XSRF config (redundant with defaults but explicit is fine)
  xsrfCookieName: 'XSRF-TOKEN',   // <-- read CSRF cookie
  xsrfHeaderName: 'X-XSRF-TOKEN', // <-- send CSRF header automatically
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Optional: prime CSRF cookie once at app bootstrap
let _csrfPrimed = false;
export async function primeCsrf() {
  if (_csrfPrimed) return;
  try {
    await axiosClient.get('/auth/csrf');
  } catch {
    // ignore; server may not require CSRF in dev
  } finally {
    _csrfPrimed = true;
  }
}

// Mark requests where we DON'T want 402 auto-redirects (e.g., login/logout)
export function withNoUpgradeRedirect(config = {}) {
  return { ...config, __suppressUpgradeRedirect: true };
}

axiosClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const cfg = err?.config || {};
    const data = err?.response?.data || {};
    const reason = data.reason || data.code;

    if (status === 401) {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
          window.dispatchEvent(new CustomEvent('auth-unauthorized'));
        } catch {}
      }
    }

    if (status === 402) {
      // Avoid redirect loops during auth flows; let UI handle the message.
      const isAuthFlow =
        (typeof cfg.url === 'string') &&
        (cfg.url.includes('/auth/login') || cfg.url.includes('/auth/logout'));

      if (cfg.__suppressUpgradeRedirect || isAuthFlow) {
        // Tag the error so callers can show a nice inline message.
        err.isPlanGate = true;
        err.planReason = reason || 'PREMIUM_REQUIRED';
        return Promise.reject(err);
      }

      // Default behavior: send user to upgrade page
      if (typeof window !== 'undefined' && window.location && typeof window.location.assign === 'function') {
        window.location.assign('/settings/upgrade');
      }
    }

    return Promise.reject(err);
  }
);

export default axiosClient;

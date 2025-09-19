import axios from 'axios';

axios.defaults.xsrfCookieName = 'XSRF-TOKEN';
axios.defaults.xsrfHeaderName = 'X-XSRF-TOKEN';

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
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

export default axiosClient;

// ---- CSRF prime (unchanged) ----
let _csrfPrimed = false;
export async function primeCsrf() {
  if (_csrfPrimed) return;
  try { await axiosClient.get('/auth/csrf'); } catch {}
  _csrfPrimed = true;
}

// ---- HMR-safe interceptors ----
let _attached = false;
let _reqId = null;
let _resId = null;

function attachInterceptorsOnce() {
  if (_attached) return;
  _attached = true;

  _resId = axiosClient.interceptors.response.use(
    (res) => res,
    (err) => {
      const status = err?.response?.status;
      const cfg = err?.config || {};
      const data = err?.response?.data || {};
      const reason = data.reason || data.code;

      if (status === 401 && typeof window !== 'undefined') {
        try { window.dispatchEvent(new CustomEvent('auth-unauthorized')); } catch {}
      }

      if (status === 402) {
        const isAuthFlow =
          typeof cfg.url === 'string' &&
          (cfg.url.includes('/auth/login') || cfg.url.includes('/auth/logout'));

        if (cfg.__suppressUpgradeRedirect || isAuthFlow) {
          err.isPlanGate = true;
          err.planReason = reason || 'PREMIUM_REQUIRED';
          return Promise.reject(err);
        }
        if (typeof window !== 'undefined' && window.location?.assign) {
          window.location.assign('/settings/upgrade');
        }
      }

      return Promise.reject(err);
    }
  );

  // HMR cleanup — use eval so Jest never parses `import.meta`
  let viteHot;
  try {
    // eslint-disable-next-line no-eval
    viteHot = (0, eval)('import.meta.hot');
  } catch {
    viteHot = undefined;
  }
  if (viteHot) {
    viteHot.dispose(() => {
      if (_reqId != null) axiosClient.interceptors.request.eject(_reqId);
      if (_resId != null) axiosClient.interceptors.response.eject(_resId);
      _attached = false;
      _reqId = _resId = null;
    });
  }
}

attachInterceptorsOnce();

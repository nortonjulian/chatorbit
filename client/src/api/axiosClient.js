import axios from 'axios';

/** -------- Base URL detection (Vite first) -------- */
const viteBase =
  (typeof import.meta !== 'undefined' && import.meta.env && (
    import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL
  )) || null;

const winBase =
  (typeof window !== 'undefined' && window.__API_URL__) || null;

const nodeBase =
  (typeof process !== 'undefined' && process.env && (
    process.env.VITE_API_BASE_URL || process.env.VITE_API_URL
  )) || null;

const baseURL = viteBase || winBase || nodeBase || 'http://localhost:5002';

/** -------- Axios instance -------- */
const axiosClient = axios.create({
  baseURL,
  withCredentials: true,           // <- REQUIRED so cookies are sent/stored
  timeout: 20000,
  xsrfCookieName: 'XSRF-TOKEN',    // <- cookie name we read from
  xsrfHeaderName: 'X-XSRF-TOKEN',  // <- header name we send
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

/** -------- Helpers -------- */
function readCookie(name) {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : '';
}

async function ensureCsrfPrimed() {
  // If we already have the readable cookie, we’re good.
  if (readCookie('XSRF-TOKEN')) return;

  try {
    // This endpoint should set _csrf (httpOnly) + XSRF-TOKEN (readable)
    await axiosClient.get('/auth/csrf', { withCredentials: true });
  } catch {
    // Even if this fails, we’ll still try to proceed; server will 403 if needed.
  }
}

/** -------- Interceptors -------- */

// Attach CSRF for mutating requests and ensure it’s primed.
axiosClient.interceptors.request.use(async (config) => {
  const method = String(config.method || 'get').toUpperCase();
  const isMutating = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

  if (isMutating) {
    await ensureCsrfPrimed();

    // If axios xsrf machinery didn’t add the header yet, set it from cookie manually.
    const hasHeader =
      (config.headers && (config.headers['X-XSRF-TOKEN'] || config.headers['x-xsrf-token'])) ||
      (axiosClient.defaults.headers.common && axiosClient.defaults.headers.common['X-XSRF-TOKEN']);

    if (!hasHeader) {
      const token = readCookie('XSRF-TOKEN');
      if (token) {
        config.headers = config.headers || {};
        config.headers['X-XSRF-TOKEN'] = token;
      }
    }
  }

  return config;
});

// Dev-friendly error log
axiosClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (typeof window !== 'undefined' && import.meta?.env?.DEV) {
      // eslint-disable-next-line no-console
      console.error('axios error:', {
        url: err?.config?.url,
        method: err?.config?.method,
        status: err?.response?.status,
        data: err?.response?.data,
      });
    }
    return Promise.reject(err);
  }
);

export default axiosClient;

/** ------- Optional: explicit CSRF primer you can call on app start ------- */
let _csrfPrimed = false;
export async function primeCsrf() {
  if (_csrfPrimed) return;
  try {
    await axiosClient.get('/auth/csrf', { withCredentials: true });
  } catch {}
  _csrfPrimed = true;
}

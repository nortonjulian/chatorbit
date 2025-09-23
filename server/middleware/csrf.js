// Environment-aware CSRF middleware.
// - In tests, we NO-OP so supertest flows aren’t blocked.
// - In other envs, we use cookie-based `csurf` with strong defaults.

import csurf from 'csurf';

const NOOP = (_req, _res, next) => next();

/**
 * Factory: build a csurf middleware instance for the current env.
 * In NODE_ENV=test, returns a no-op.
 */
export function buildCsrf({ isProd = process.env.NODE_ENV === 'production', cookieDomain } = {}) {
  if (process.env.NODE_ENV === 'test') return NOOP;

  return csurf({
    cookie: {
      httpOnly: true,
      secure: isProd,
      // 'lax' is usually friendlier for SPAs; 'strict' can be okay on same-site localhost,
      // but 'lax' avoids edge cases with redirects. Pick what you prefer.
      sameSite: 'lax',
      domain: cookieDomain || undefined,
      path: '/',
    },
    value: (req) => {
      const h = req.headers || {};
      // Node lowercases header names, so check lowercase keys
      return (
        h['x-csrf-token'] ||
        h['csrf-token'] ||
        h['x-xsrf-token'] ||
        req.body?._csrf ||
        req.query?._csrf ||
        req.cookies?.['XSRF-TOKEN'] // double-submit fallback
      );
    },
  });
}

/**
 * Issue a readable XSRF token cookie (not httpOnly) for browser JS to read
 * and send back via the X-CSRF-Token header. Skips in tests.
 */
export function setCsrfCookie(req, res) {
  if (process.env.NODE_ENV === 'test') return;
  if (typeof req.csrfToken !== 'function') return;

  const token = req.csrfToken();
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false,
    secure: req.app?.get('env') === 'production',
    sameSite: 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge: 2 * 60 * 60 * 1000, // 2h
  });
}

/**
 * Convenience default export: a prebuilt middleware using process env.
 * (Useful if you just `app.use(csrfDefault)` without custom options.)
 */
const csrfDefault =
  process.env.NODE_ENV === 'test'
    ? NOOP
    : csurf({
        cookie: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          domain: process.env.COOKIE_DOMAIN || undefined,
          path: '/',
        },
        value: (req) =>
          req.headers['x-csrf-token'] ||
          req.get?.('x-csrf-token') ||
          req.body?._csrf ||
          req.query?._csrf ||
          req.cookies?.['XSRF-TOKEN'],
      });

export default csrfDefault;

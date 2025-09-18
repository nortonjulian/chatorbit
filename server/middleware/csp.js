import crypto from 'node:crypto';
import helmet from 'helmet';

function makeNonce() {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Attach res.locals.cspNonce and set a strict CSP.
 * - Default-src self
 * - Script/style/img/media/font connect upgraded as needed
 * - frame-ancestors none (disables clickjacking)
 * - upgrade-insecure-requests in prod
 */
export function csp() {
  return [
    // 1) nonce per response (available to templates / inline tag attributes if you use them)
    (req, res, next) => {
      res.locals.cspNonce = makeNonce();
      next();
    },

    // 2) Helmet CSP
    helmet.contentSecurityPolicy({
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'frame-ancestors': ["'none'"],

        // Allow your own origin for scripts; permit nonce for any inline you *must* keep
        'script-src': [
          "'self'",
          // "'strict-dynamic'", // enable if all scripts are nonced (advanced)
          (req, res) => `'nonce-${res.locals.cspNonce}'`,
        ],

        // Mantine injects styles; allow nonce for inline styles it might generate
        'style-src': [
          "'self'",
          (req, res) => `'nonce-${res.locals.cspNonce}'`,
        ],

        // images (allow data URLs for small inline assets; remove if not needed)
        'img-src': ["'self'", 'data:'],

        // fonts (local; add your CDNs if any)
        'font-src': ["'self'"],

        // XHR/websocket endpoints (adjust to your API domain if split)
        'connect-src': [
          "'self'",
          // If you use a separate API origin or sentry/analytics, list them here:
          // 'https://api.chatorbit.com',
          // 'https://o****.ingest.sentry.io',
          // 'wss://api.chatorbit.com',
        ],

        // media (voice/video); open carefully. Keep 'self' unless you stream from a CDN.
        'media-src': ["'self'"],

        // disallow all object/embed
        'object-src': ["'none'"],

        // Workers if you use them (e.g., web-rtc/encoder). Add as needed:
        // 'worker-src': ["'self'"],

        // block mixed content in prod
        'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [] : null,

        // disallow <frame>/<iframe> top-level unless you explicitly need it
        'frame-src': ["'none'"],
        'child-src': ["'none'"],
        'form-action': ["'self'"],
      },
      reportOnly: false,
    }),
  ];
}

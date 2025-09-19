import invariant from '../utils/invariant.js';
import { ENV } from './env.js';

function requireNonEmpty(value, name, advice) {
  invariant(
    !!value && String(value).trim().length > 0,
    `[env] ${name} is required${advice ? `: ${advice}` : ''}`
  );
}

/**
 * Validate critical configuration. Throw early if something is off.
 * Call this before creating/starting the HTTP server.
 */
export default function validateEnv() {
  const { IS_PROD, IS_TEST } = ENV;

  // Core required
  requireNonEmpty(ENV.DATABASE_URL, 'DATABASE_URL');
  requireNonEmpty(ENV.JWT_SECRET, 'JWT_SECRET', 'use a long random string (>= 32 chars recommended)');
  invariant(
    ENV.JWT_SECRET.length >= 16 || !IS_PROD,
    '[env] JWT_SECRET should be at least 16 chars in production'
  );

  // HTTPS / cookies
  if (IS_PROD) {
    invariant(ENV.FORCE_HTTPS, '[env] FORCE_HTTPS must be true in production');
    invariant(
      ENV.COOKIE_DOMAIN || true, // optional but recommended
      '[env] Consider setting COOKIE_DOMAIN for cross-subdomain cookies'
    );
    invariant(ENV.COOKIE_SECURE, '[env] COOKIE_SECURE must be true in production');
  }

  // CORS: at least one allowed origin (frontend)
  invariant(
    (ENV.CORS_ORIGINS && ENV.CORS_ORIGINS.length > 0) || !!ENV.FRONTEND_ORIGIN || IS_TEST,
    '[env] CORS_ORIGINS or FRONTEND_ORIGIN should be set (comma-separated origins)'
  );

  // Stripe: if one is set, require the other
  if (ENV.STRIPE_SECRET_KEY || ENV.STRIPE_WEBHOOK_SECRET) {
    requireNonEmpty(ENV.STRIPE_SECRET_KEY, 'STRIPE_SECRET_KEY');
    requireNonEmpty(ENV.STRIPE_WEBHOOK_SECRET, 'STRIPE_WEBHOOK_SECRET');
  }

  // Telco: if provider is selected, enforce that provider's credentials
  if (ENV.TELCO_PROVIDER === 'telnyx') {
    requireNonEmpty(ENV.TELNYX_API_KEY, 'TELNYX_API_KEY');
    invariant(
      !!ENV.TELNYX_MESSAGING_PROFILE_ID || !!ENV.TELNYX_FROM_NUMBER,
      '[env] TELNYX_MESSAGING_PROFILE_ID or TELNYX_FROM_NUMBER is required for Telnyx'
    );
  }
  if (ENV.TELCO_PROVIDER === 'bandwidth') {
    requireNonEmpty(ENV.BANDWIDTH_ACCOUNT_ID, 'BANDWIDTH_ACCOUNT_ID');
    requireNonEmpty(ENV.BANDWIDTH_USER_ID, 'BANDWIDTH_USER_ID');
    requireNonEmpty(ENV.BANDWIDTH_PASSWORD, 'BANDWIDTH_PASSWORD');
    requireNonEmpty(ENV.BANDWIDTH_MESSAGING_APPLICATION_ID, 'BANDWIDTH_MESSAGING_APPLICATION_ID');
    requireNonEmpty(ENV.BANDWIDTH_FROM_NUMBER, 'BANDWIDTH_FROM_NUMBER');
  }

  // Upload target
  invariant(
    ['memory', 'local', 'disk'].includes(ENV.UPLOAD_TARGET),
    `[env] UPLOAD_TARGET must be one of memory|local|disk (got "${ENV.UPLOAD_TARGET}")`
  );

  // Optional Sentry advice (warn-style)
  if (IS_PROD && !ENV.SENTRY_DSN) {
    // eslint-disable-next-line no-console
    console.warn('[env] SENTRY_DSN not set — error visibility will be reduced in production');
  }

  // Test-specific relaxations
  if (IS_TEST) {
    // Nothing special for now
  }
}

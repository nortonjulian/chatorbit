const bool = (v, dflt = false) => {
  if (v == null) return dflt;
  const s = String(v).toLowerCase().trim();
  return ['1', 'true', 'yes', 'on'].includes(s);
};

const num = (v, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};

/**
 * Canonical normalized env (used across the app).
 * Secrets are READ here, not hard-coded.
 */
export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PROD: (process.env.NODE_ENV || '').toLowerCase() === 'production',
  IS_TEST: (process.env.NODE_ENV || '').toLowerCase() === 'test',

  // Core
  PORT: num(process.env.PORT, 5002),
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || '',
  COOKIE_SECURE: bool(process.env.COOKIE_SECURE, false),
  FORCE_HTTPS: bool(process.env.FORCE_HTTPS, true),

  // CORS / origins
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || '',
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Sentry (optional)
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  SENTRY_TRACES_RATE: process.env.SENTRY_TRACES_RATE || '',

  // Stripe (optional; enforced only if enabled)
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',

  // Telco (optional; enforced if provider is selected)
  TELCO_PROVIDER: (process.env.TELCO_PROVIDER || '').toLowerCase(),
  TELNYX_API_KEY: process.env.TELNYX_API_KEY || '',
  TELNYX_MESSAGING_PROFILE_ID: process.env.TELNYX_MESSAGING_PROFILE_ID || '',
  TELNYX_FROM_NUMBER: process.env.TELNYX_FROM_NUMBER || '',
  TELNYX_CONNECTION_ID: process.env.TELNYX_CONNECTION_ID || '',

  BANDWIDTH_ACCOUNT_ID: process.env.BANDWIDTH_ACCOUNT_ID || '',
  BANDWIDTH_USER_ID: process.env.BANDWIDTH_USERNAME || process.env.BANDWIDTH_USER_ID || '', // support both
  BANDWIDTH_PASSWORD: process.env.BANDWIDTH_PASSWORD || '',
  BANDWIDTH_MESSAGING_APPLICATION_ID: process.env.BANDWIDTH_MESSAGING_APPLICATION_ID || '',
  BANDWIDTH_VOICE_APPLICATION_ID: process.env.BANDWIDTH_VOICE_APPLICATION_ID || '',
  BANDWIDTH_FROM_NUMBER: process.env.BANDWIDTH_FROM_NUMBER || '',

  // Number lifecycle settings (carry over your existing defaults)
  NUMBER_INACTIVITY_DAYS: num(process.env.NUMBER_INACTIVITY_DAYS, 30),
  NUMBER_HOLD_DAYS: num(process.env.NUMBER_HOLD_DAYS, 14),
  RESERVATION_MINUTES: num(process.env.RESERVATION_MINUTES, 10),
  DEFAULT_PROVIDER: (process.env.DEFAULT_PROVIDER || 'telnyx').toLowerCase(),

  // Mailer (optional; we fall back to JSON transport in dev)
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: num(process.env.SMTP_PORT, 587),
  SMTP_SECURE: bool(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',

  // Feature flags
  STATUS_ENABLED: bool(process.env.STATUS_ENABLED, false),

  // Uploads
  UPLOAD_TARGET: (process.env.UPLOAD_TARGET || 'memory').toLowerCase(),
};

/**
 * 🔁 Compatibility facade for legacy imports:
 *   import { cfg, assertProviderEnv } from './config/env.js'
 */
export const cfg = {
  telnyxApiKey: ENV.TELNYX_API_KEY,
  telnyxMessagingProfileId: ENV.TELNYX_MESSAGING_PROFILE_ID,
  telnyxConnectionId: ENV.TELNYX_CONNECTION_ID,

  bwAccountId: ENV.BANDWIDTH_ACCOUNT_ID,
  bwUser: ENV.BANDWIDTH_USER_ID,
  bwPass: ENV.BANDWIDTH_PASSWORD,
  bwMsgAppId: ENV.BANDWIDTH_MESSAGING_APPLICATION_ID,
  bwVoiceAppId: ENV.BANDWIDTH_VOICE_APPLICATION_ID,

  inactivityDays: ENV.NUMBER_INACTIVITY_DAYS,
  holdDays: ENV.NUMBER_HOLD_DAYS,
  reserveMinutes: ENV.RESERVATION_MINUTES,
  defaultProvider: ENV.DEFAULT_PROVIDER,
};

/**
 * Legacy soft-check:
 * Warn if provider creds are missing; do NOT throw.
 * Strict enforcement happens in validateEnv() when provider is selected.
 */
export function assertProviderEnv() {
  const missing = [];
  // Telnyx
  if (!ENV.TELNYX_API_KEY) missing.push('TELNYX_API_KEY');
  if (!ENV.TELNYX_MESSAGING_PROFILE_ID && !ENV.TELNYX_FROM_NUMBER) {
    missing.push('TELNYX_MESSAGING_PROFILE_ID or TELNYX_FROM_NUMBER');
  }
  // Bandwidth
  if (!ENV.BANDWIDTH_ACCOUNT_ID) missing.push('BANDWIDTH_ACCOUNT_ID');
  if (!ENV.BANDWIDTH_USER_ID) missing.push('BANDWIDTH_USERNAME/BANDWIDTH_USER_ID');
  if (!ENV.BANDWIDTH_PASSWORD) missing.push('BANDWIDTH_PASSWORD');
  if (!ENV.BANDWIDTH_MESSAGING_APPLICATION_ID) missing.push('BANDWIDTH_MESSAGING_APPLICATION_ID');

  if (missing.length) {
    // eslint-disable-next-line no-console
    console.warn(
      '[WARN] Missing env:',
      missing.join(', '),
      '— the corresponding provider features will be disabled until set.'
    );
  }
}

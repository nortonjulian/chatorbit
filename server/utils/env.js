/**
 * Ensure an environment variable exists and return its value.
 * Throws if missing or empty (unless allowEmpty is true).
 */
export function requireEnv(name, opts = {}) {
  const val = process.env[name];
  if (!val || (!opts.allowEmpty && String(val).trim() === '')) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

/**
 * Ensure a set of environment variables are defined and non-empty.
 * Throws with a combined error if any are missing.
 */
export function assertRequiredEnv(names) {
  const missing = names.filter(
    (n) => !process.env[n] || String(process.env[n]).trim() === ''
  );
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

/**
 * Coerce an environment flag into a boolean.
 * Example: isTrue(process.env.STATUS_ENABLED)
 */
export const isTrue = (v) => String(v ?? '').toLowerCase() === 'true';

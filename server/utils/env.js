export function requireEnv(name, opts = {}) {
  const val = process.env[name];
  if (!val || (!opts.allowEmpty && String(val).trim() === '')) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

export function assertRequiredEnv(names) {
  const missing = names.filter((n) => !process.env[n] || String(process.env[n]).trim() === '');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

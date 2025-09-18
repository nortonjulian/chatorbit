// Registry + common interface for telco providers.
// Each provider module must export a default object with:
// {
//   providerName: 'telnyx' | 'bandwidth',
//   searchAvailable({ areaCode, country, type, limit }) => { items: string[] },
//   purchaseNumber({ phoneNumber }) => { order?: any },
//   releaseNumber({ phoneNumber }) => void,
//   configureWebhooks?({ phoneNumber }) => void
// }

let telnyxAdapter = null;
let bandwidthAdapter = null;

try {
  const mod = await import('./telnyx.js');
  telnyxAdapter = mod?.default || null;
} catch (e) {
  // optional
}

try {
  const mod = await import('./bandwidth.js');
  bandwidthAdapter = mod?.default || null;
} catch (e) {
  // optional
}

// Very small safety mock so the app can boot without provider creds
const mockAdapter = {
  providerName: 'mock',
  async searchAvailable() {
    // Return empty list rather than throwing; keeps UI/server usable in dev
    return { items: [] };
  },
  async purchaseNumber() {
    throw new Error('Mock provider cannot purchase numbers. Configure TELCO_PROVIDER and credentials.');
  },
  async releaseNumber() {
    // no-op
  },
  async configureWebhooks() {
    // no-op
  },
};

const registry = Object.fromEntries(
  [
    telnyxAdapter ? ['telnyx', telnyxAdapter] : null,
    bandwidthAdapter ? ['bandwidth', bandwidthAdapter] : null,
  ].filter(Boolean)
);

const defaultKey =
  (process.env.TELCO_PROVIDER || '').toLowerCase() ||
  (registry.telnyx ? 'telnyx' : registry.bandwidth ? 'bandwidth' : 'mock');

/** Get a provider by key (e.g., 'telnyx' or 'bandwidth'), falls back to default, then to mock. */
export function getProvider(key) {
  const k = String(key || '').toLowerCase();
  return registry[k] || registry[defaultKey] || mockAdapter;
}

export const providerName = defaultKey;
export const providers = registry;

export default getProvider(defaultKey);

/* -------------------- NEW: SMS sending with fallback -------------------- */

/**
 * @typedef {Object} SmsSendParams
 * @property {string} to        E.164 number (e.g., +15551234567)
 * @property {string} [from]    Optional E.164; defaults to provider's number/profile
 * @property {string} text      Message body
 * @property {string} [clientRef] Correlation id for receipts
 */

/** provider-local senders (SDKs are optional; we lazy-load) */
async function sendViaTelnyx({ to, from, text, clientRef }) {
  const { TELNYX_API_KEY, TELNYX_MESSAGING_PROFILE_ID, TELNYX_FROM_NUMBER } = process.env;
  if (!TELNYX_API_KEY) throw new Error('Telnyx not configured');

  const telnyxMod = await import('telnyx');
  const tx = telnyxMod.default ? telnyxMod.default(TELNYX_API_KEY) : telnyxMod(TELNYX_API_KEY);

  const resolvedFrom = from || TELNYX_FROM_NUMBER || TELNYX_MESSAGING_PROFILE_ID;
  if (!resolvedFrom) throw new Error('Missing TELNYX_MESSAGING_PROFILE_ID or TELNYX_FROM_NUMBER');

  const { data } = await tx.messages.create({
    from: resolvedFrom,           // can be a profile id or E.164 depending on your account setup
    to,
    text,
    client_ref: clientRef,
  });

  return { provider: 'telnyx', messageId: data?.id || '' };
}

async function sendViaBandwidth({ to, from, text, clientRef }) {
  const {
    BANDWIDTH_ACCOUNT_ID,
    BANDWIDTH_USERNAME,
    BANDWIDTH_PASSWORD,
    BANDWIDTH_MESSAGING_APPLICATION_ID,
    BANDWIDTH_FROM_NUMBER,
  } = process.env;

  if (!BANDWIDTH_ACCOUNT_ID || !BANDWIDTH_USERNAME || !BANDWIDTH_PASSWORD) {
    throw new Error('Bandwidth not configured');
  }

  const bwMsg = await import('@bandwidth/messaging');
  const client = new bwMsg.Messaging.Client({
    basicAuthUsername: BANDWIDTH_USERNAME,
    basicAuthPassword: BANDWIDTH_PASSWORD,
  });

  const resolvedFrom = from || BANDWIDTH_FROM_NUMBER;
  if (!BANDWIDTH_MESSAGING_APPLICATION_ID || !resolvedFrom) {
    throw new Error('Missing Bandwidth messaging configuration');
  }

  const body = {
    applicationId: BANDWIDTH_MESSAGING_APPLICATION_ID,
    to: [to],
    from: resolvedFrom,
    text,
    tag: clientRef,
  };

  const res = await client.createMessage(BANDWIDTH_ACCOUNT_ID, body);
  const messageId = res?.data?.id || res?.id || '';
  return { provider: 'bandwidth', messageId };
}

function resolvePrimaryName(preferred) {
  const envPref = (process.env.INVITES_PROVIDER || '').toLowerCase();
  return (preferred || envPref || defaultKey || 'telnyx').toLowerCase();
}

/**
 * Send SMS using PRIMARY provider with automatic FALLBACK.
 * @param {SmsSendParams & { preferred?: 'telnyx'|'bandwidth' }} params
 * @returns {Promise<{provider: 'telnyx'|'bandwidth', messageId: string}>}
 */
export async function sendSmsWithFallback({ to, from, text, clientRef, preferred }) {
  const primaryName = resolvePrimaryName(preferred);
  const order = primaryName === 'bandwidth'
    ? [sendViaBandwidth, sendViaTelnyx]
    : [sendViaTelnyx, sendViaBandwidth];

  let lastErr;
  for (const fn of order) {
    try {
      return await fn({ to, from, text, clientRef });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('No SMS provider succeeded');
}

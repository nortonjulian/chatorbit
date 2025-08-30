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

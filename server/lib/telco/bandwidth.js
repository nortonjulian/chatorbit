// Minimal REST-based adapter for Bandwidth Numbers API.
// Docs: https://docs.bandwidth.com/docs/numbers
//
// ENV needed (typical):
// - BANDWIDTH_ACCOUNT_ID
// - BANDWIDTH_USERNAME
// - BANDWIDTH_PASSWORD
//
// Often also needed for full provisioning/routing:
// - BANDWIDTH_SITE_ID
// - BANDWIDTH_VOICE_APPLICATION_ID
// - BANDWIDTH_MESSAGING_APPLICATION_ID
//
// NOTE: The Bandwidth Orders flow is more involved (Sites, Subscriptions, Orders).
// Below is a pragmatic adapter: search works; purchase/release are left as either
// "mock" (if BANDWIDTH_MOCK=true) or stubs to extend when you’re ready.

const BASE = 'https://numbers.bandwidth.com/api/v1';

function basicAuth() {
  const u = process.env.BANDWIDTH_USERNAME;
  const p = process.env.BANDWIDTH_PASSWORD;
  if (!u || !p) return null;
  const token = Buffer.from(`${u}:${p}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

function ensureCreds() {
  const id = process.env.BANDWIDTH_ACCOUNT_ID;
  const u = process.env.BANDWIDTH_USERNAME;
  const p = process.env.BANDWIDTH_PASSWORD;
  if (!id || !u || !p) {
    throw new Error('BANDWIDTH_ACCOUNT_ID / BANDWIDTH_USERNAME / BANDWIDTH_PASSWORD are required');
  }
}

async function bwFetch(urlPath, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...basicAuth(),
    ...(opts.headers || {}),
  };
  const res = await fetch(`${BASE}${urlPath}`, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Bandwidth API ${urlPath} failed: ${res.status} ${text || res.statusText}`);
  }
  // Some endpoints return empty 204; guard JSON parse
  const txt = await res.text();
  return txt ? JSON.parse(txt) : {};
}

const adapter = {
  providerName: 'bandwidth',

  /**
   * Search available numbers
   * @param {Object} p
   * @param {string} [p.areaCode]
   * @param {string} [p.country='US']  // Bandwidth focuses on US
   * @param {string} [p.type='local']  // 'local' | 'tollFree'
   * @param {number} [p.limit=20]
   * @returns {Promise<{items:string[]}>}
   */
  async searchAvailable({ areaCode, country = 'US', type = 'local', limit = 20 } = {}) {
    // If creds missing, return empty — keeps server usable in dev
    const missing =
      !process.env.BANDWIDTH_ACCOUNT_ID ||
      !process.env.BANDWIDTH_USERNAME ||
      !process.env.BANDWIDTH_PASSWORD;

    if (missing) {
      console.warn('[bandwidth] credentials missing — returning empty search results.');
      return { items: [] };
    }

    const acct = process.env.BANDWIDTH_ACCOUNT_ID;

    // Ref: GET /accounts/{accountId}/availableNumbers
    // Docs accept filters like areaCode, quantity, tollFree, etc.
    const qs = new URLSearchParams();
    if (areaCode) qs.set('areaCode', String(areaCode));
    if (limit) qs.set('quantity', String(limit));
    if (type && type.toLowerCase().includes('toll')) qs.set('tollFree', 'true');

    const json = await bwFetch(`/accounts/${acct}/availableNumbers?${qs.toString()}`, {
      method: 'GET',
    });

    // Response shapes vary; try common fields
    // Sometimes: { telephoneNumberList: { telephoneNumber: ["+1555..."] } }
    // Or: { numbers: ["+1555..."] }
    const list =
      json?.telephoneNumberList?.telephoneNumber ||
      json?.numbers ||
      json?.availableNumbers ||
      [];

    const items = Array.isArray(list) ? list.map(String) : [];
    return { items };
  },

  /**
   * Purchase/provision a number
   * The real Bandwidth flow uses "orders" with Sites/Subscriptions.
   * Provide a MOCK for now unless you’ve wired full provisioning.
   */
  async purchaseNumber({ phoneNumber }) {
    if (process.env.BANDWIDTH_MOCK === 'true') {
      console.warn('[bandwidth] MOCK purchaseNumber returning a fake order.');
      return { order: { id: 'mock-order', phoneNumber } };
    }
    ensureCreds();
    // TODO: Implement the full order payload once Sites/Apps are set.
    // Docs: POST /accounts/{accountId}/orders
    // https://docs.bandwidth.com/docs/numbers#orders
    throw new Error('Bandwidth purchaseNumber not implemented yet. Set BANDWIDTH_MOCK=true for dev.');
  },

  /**
   * Release a number
   * The API for "releasing" numbers is via DELETE on TNs endpoint or via Orders (depending on setup).
   */
  async releaseNumber({ phoneNumber }) {
    if (process.env.BANDWIDTH_MOCK === 'true') {
      console.warn('[bandwidth] MOCK releaseNumber ok for', phoneNumber);
      return;
    }
    ensureCreds();
    // TODO: Implement per your Bandwidth account setup.
    // Often: DELETE /accounts/{accountId}/phoneNumbers/{tn}
    // https://docs.bandwidth.com/docs/numbers#delete-phone-number
    throw new Error('Bandwidth releaseNumber not implemented yet. Set BANDWIDTH_MOCK=true for dev.');
  },

  async configureWebhooks(_p) {
    // TODO: attach messaging/voice application IDs if you’re using Bandwidth for inbound/outbound
    return;
  },
};

export default adapter;

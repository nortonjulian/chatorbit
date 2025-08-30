// Minimal REST-based adapter using Telnyx v2 API.
// Docs: https://developers.telnyx.com/docs/api
//
// ENV needed (typical):
// - TELNYX_API_KEY
//
// Optional for future routing/webhooks:
// - TELNYX_MESSAGING_PROFILE_ID
// - TELNYX_CONNECTION_ID

const API = 'https://api.telnyx.com/v2';

function authHeader() {
  const key = process.env.TELNYX_API_KEY;
  if (!key) return null;
  return { Authorization: `Bearer ${key}` };
}

function ensureKey() {
  if (!process.env.TELNYX_API_KEY) {
    throw new Error('TELNYX_API_KEY is not set');
  }
}

async function telnyxFetch(path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...authHeader(),
    ...(opts.headers || {}),
  };
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Telnyx API ${path} failed: ${res.status} ${text || res.statusText}`);
  }
  return res.json();
}

const adapter = {
  providerName: 'telnyx',

  /**
   * Search available numbers
   * @param {Object} p
   * @param {string} [p.areaCode]
   * @param {string} [p.country='US']
   * @param {string} [p.type='local']  // 'local' | 'toll-free'
   * @param {number} [p.limit=20]
   * @returns {Promise<{items:string[]}>}
   */
  async searchAvailable({ areaCode, country = 'US', type = 'local', limit = 20 } = {}) {
    // If no key, return empty — keeps server routes working in dev
    if (!process.env.TELNYX_API_KEY) {
      console.warn('[telnyx] TELNYX_API_KEY missing — returning empty search results.');
      return { items: [] };
    }

    const qs = new URLSearchParams();
    if (country) qs.set('filter[country_code]', country);
    if (areaCode) qs.set('filter[national_destination_code]', String(areaCode));
    if (type) qs.set('filter[phone_number_type]', type);
    if (limit) qs.set('page[size]', String(limit));

    // Ref: /v2/available_phone_numbers
    const json = await telnyxFetch(`/available_phone_numbers?${qs.toString()}`, { method: 'GET' });

    const items =
      (json?.data || [])
        .map((n) => n?.phone_number || n?.phoneNumber || n?.number)
        .filter(Boolean);

    return { items };
  },

  /**
   * Purchase/provision a number
   * @param {Object} p
   * @param {string} p.phoneNumber // E.164
   */
  async purchaseNumber({ phoneNumber }) {
    ensureKey();
    if (!phoneNumber) throw new Error('phoneNumber required');

    // Ref: POST /v2/number_orders
    const body = {
      phone_numbers: [{ phone_number: phoneNumber }],
    };

    const json = await telnyxFetch('/number_orders', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return { order: json?.data || json };
  },

  /**
   * Release a number
   * @param {Object} p
   * @param {string} p.phoneNumber // E.164
   */
  async releaseNumber({ phoneNumber }) {
    ensureKey();
    if (!phoneNumber) throw new Error('phoneNumber required');

    // Ref: DELETE /v2/phone_numbers/{id or phone_number}
    // Telnyx supports using the phone number in path for delete.
    const enc = encodeURIComponent(phoneNumber);
    await telnyxFetch(`/phone_numbers/${enc}`, { method: 'DELETE' });
  },

  /**
   * Optional: configure inbound/outbound routing, webhooks, etc.
   * No-op here; wire up if/when you add messaging/voice.
   */
  async configureWebhooks(_p) {
    // e.g., attach messaging profile, set webhooks, etc.
    return;
  },
};

export default adapter;

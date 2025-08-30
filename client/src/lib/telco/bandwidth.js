import fetch from 'node-fetch';


const BASE = 'https://numbers.bandwidth.com/api/v1.0/accounts';
function auth() {
const u = process.env.BANDWIDTH_USERNAME;
const p = process.env.BANDWIDTH_PASSWORD;
return 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');
}


export async function searchNumbers({ areaCode, vanity=false, limit=20 }) {
const accountId = process.env.BANDWIDTH_ACCOUNT_ID;
const params = new URLSearchParams({ areaCode: areaCode || '', quantity: String(limit) });
const res = await fetch(`${BASE}/${accountId}/availableNumbers?${params}`, {
headers: { Authorization: auth() }
});
const json = await res.json();
return (json.telephoneNumberList || []).map(n => ({
e164: `+1${n.telephoneNumber}`,
areaCode: n.npa,
vanity: vanity && !!n.vanity
}));
}


export async function purchase(e164) {
const accountId = process.env.BANDWIDTH_ACCOUNT_ID;
const body = {
orderCreateDate: new Date().toISOString(),
existingTelephoneNumberOrderType: { telephoneNumberList: { telephoneNumber: [e164.replace('+1','')] } }
};
const res = await fetch(`${BASE}/${accountId}/orders`, {
method: 'POST',
headers: { 'Content-Type': 'application/json', Authorization: auth() },
body: JSON.stringify(body)
});
if (!res.ok) throw new Error(`Bandwidth purchase failed: ${res.status}`);
const json = await res.json();
return { providerNumberId: json.Order?.id || null };
}


export async function release(e164) {
// Bandwidth: disconnect order
return { ok: true };
}


export async function configureWebhooks(e164) {
// Make sure your Messaging Application is set to your webhooks; number assignment may inherit that.
return { ok: true };
}
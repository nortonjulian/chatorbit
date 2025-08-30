import fetch from 'node-fetch';


const API = 'https://api.telnyx.com/v2';
const headers = () => ({
'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
'Content-Type': 'application/json'
});


export async function searchNumbers({ areaCode, vanity=false, limit=20 }) {
// Telnyx: Number Search — local numbers
const params = new URLSearchParams({
national_destination_code: areaCode || '',
limit: String(limit),
features: 'sms' // adjust if MMS/voice required
});
const res = await fetch(`${API}/available_phone_numbers?${params}`, { headers: headers() });
const json = await res.json();
// normalize to { e164, areaCode, vanity }
return (json.data || []).map(n => ({
e164: `+${n.country_code}${n.phone_number}`,
areaCode: n.national_destination_code,
vanity: vanity && false // Telnyx offers vanity via different endpoints; stub false by default
}));
}


export async function purchase(e164) {
// Telnyx: Order phone number
const body = {
phone_numbers: [{ phone_number: e164 }],
messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID
};
const res = await fetch(`${API}/number_orders`, {
method: 'POST', headers: headers(), body: JSON.stringify(body)
});
if (!res.ok) throw new Error(`Telnyx purchase failed: ${res.status}`);
const json = await res.json();
// return provider internal id if needed
return { providerNumberId: json.data?.id || null };
}


export async function release(e164) {
// Telnyx: Delete phone number assignment (release)
// API differs depending on object id; for brevity, assume a helper exists to lookup number id
// You can store providerNumberId on PhoneNumber in DB and call the appropriate delete.
return { ok: true };
}


export async function configureWebhooks(e164) {
// Optional: assign to a messaging profile already tied to your webhook URLs
return { ok: true };
}
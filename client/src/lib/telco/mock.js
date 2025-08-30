export async function searchNumbers({ areaCode, limit = 20 }) {
  return [
    { e164: '+13035550101', areaCode: '303', vanity: false },
    { e164: '+13035550102', areaCode: '303', vanity: true  },
  ].filter(n => !areaCode || n.areaCode === String(areaCode)).slice(0, limit);
}
export async function purchase(e164) { return { providerNumberId: `mock_${e164}` }; }
export async function release() { return { ok: true }; }
export async function configureWebhooks() { return { ok: true }; }

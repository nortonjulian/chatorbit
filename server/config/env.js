export const cfg = {
  telnyxApiKey: process.env.TELNYX_API_KEY,
  telnyxMessagingProfileId: process.env.TELNYX_MESSAGING_PROFILE_ID,
  telnyxConnectionId: process.env.TELNYX_CONNECTION_ID, // optional

  bwAccountId: process.env.BANDWIDTH_ACCOUNT_ID,
  bwUser: process.env.BANDWIDTH_USERNAME,
  bwPass: process.env.BANDWIDTH_PASSWORD,
  bwMsgAppId: process.env.BANDWIDTH_MESSAGING_APPLICATION_ID,
  bwVoiceAppId: process.env.BANDWIDTH_VOICE_APPLICATION_ID,

  inactivityDays: Number(process.env.NUMBER_INACTIVITY_DAYS || 30),
  holdDays: Number(process.env.NUMBER_HOLD_DAYS || 14),
  reserveMinutes: Number(process.env.RESERVATION_MINUTES || 10),
  defaultProvider: (process.env.DEFAULT_PROVIDER || 'telnyx').toLowerCase(),
};

export function assertProviderEnv() {
  const missing = [];
  if (!cfg.telnyxApiKey) missing.push('TELNYX_API_KEY');
  if (!cfg.telnyxMessagingProfileId) missing.push('TELNYX_MESSAGING_PROFILE_ID');
  if (!cfg.bwAccountId) missing.push('BANDWIDTH_ACCOUNT_ID');
  if (!cfg.bwUser) missing.push('BANDWIDTH_USERNAME');
  if (!cfg.bwPass) missing.push('BANDWIDTH_PASSWORD');
  if (!cfg.bwMsgAppId) missing.push('BANDWIDTH_MESSAGING_APPLICATION_ID');
  if (missing.length) {
    console.warn('[WARN] Missing env:', missing.join(', '), '— only the corresponding provider features will be disabled.');
  }
}

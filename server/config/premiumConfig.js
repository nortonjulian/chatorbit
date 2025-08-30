export const premiumConfig = {
  // Device limits
  FREE_DEVICE_LIMIT: Number(process.env.FREE_DEVICE_LIMIT || 1),
  PREMIUM_DEVICE_LIMIT: Number(process.env.PREMIUM_DEVICE_LIMIT || 5),

  // Disappearing message caps
  FREE_EXPIRE_MAX_DAYS: Number(process.env.FREE_EXPIRE_MAX_DAYS || 1),
  PREMIUM_EXPIRE_MAX_DAYS: Number(process.env.PREMIUM_EXPIRE_MAX_DAYS || 30),

  // Tone & theme catalogs (ids; your client maps to files/urls)
  tones: {
    freeRingtones: ['classic.mp3', 'vibrate.mp3'],
    premiumRingtones: ['galaxy.mp3', 'silk.mp3', 'aurora.mp3'],
    freeMessageTones: ['ping.mp3'],
    premiumMessageTones: ['sparkle.mp3', 'droplet.mp3'],
  },
  themes: {
    free: ['light', 'dark'],
    premium: ['amoled', 'neon', 'sunset', 'midnight', 'solarized'],
  },
};

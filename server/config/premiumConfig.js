export const premiumConfig = {
  // Device limits
  FREE_DEVICE_LIMIT: Number(process.env.FREE_DEVICE_LIMIT || 1),
  PREMIUM_DEVICE_LIMIT: Number(process.env.PREMIUM_DEVICE_LIMIT || 5),

  // Disappearing message caps
  FREE_EXPIRE_MAX_DAYS: Number(process.env.FREE_EXPIRE_MAX_DAYS || 1),
  PREMIUM_EXPIRE_MAX_DAYS: Number(process.env.PREMIUM_EXPIRE_MAX_DAYS || 30),

  // Tone & theme catalogs (ids; your client maps to files/urls)
  tones: {
    freeRingtones: ['Classic.mp3', 'Urgency.mp3'],
    premiumRingtones: ['Bells.mp3', 'Chimes.mp3', 'Digital Phone.mp3', 'Melodic.mp3', 'Organ Notes.mp3', 'Sound Reality.mp3', 'Street.mp3', 'Universfield.mp3'],
    freeMessageTones: ['Default.mp3', 'Vibrate.mp3'],
    premiumMessageTones: ['Dreamer.mp3', 'Happy Message.mp3', 'Notify.mp3', 'Pop.mp2', 'Pulsating Sound.mp3', 'Sparkel.mp3', 'Text Message.mp3', 'Xylophone.mp3'],
  },
  themes: {
    free: ['light', 'dark'],
    premium: ['amoled', 'neon', 'sunset', 'midnight', 'solarized'],
  },
};

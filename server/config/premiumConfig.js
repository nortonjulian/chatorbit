export const premiumConfig = {
  // Device limits
  FREE_DEVICE_LIMIT: Number(process.env.FREE_DEVICE_LIMIT || 1),
  PREMIUM_DEVICE_LIMIT: Number(process.env.PREMIUM_DEVICE_LIMIT || 5),

  // Disappearing message caps (days)
  FREE_EXPIRE_MAX_DAYS: Number(process.env.FREE_EXPIRE_MAX_DAYS || 1),
  PREMIUM_EXPIRE_MAX_DAYS: Number(process.env.PREMIUM_EXPIRE_MAX_DAYS || 30),

  // Tone & theme catalogs (filenames)
  tones: {
    // RINGTONES: full catalog
    allRingtones: [
      'Bells.mp3',
      'Classic.mp3',
      'Chimes.mp3',
      'Digital Phone.mp3',
      'Melodic.mp3',
      'Organ Notes.mp3',
      'Sound Reality.mp3',
      'Street.mp3',
      'Universfield.mp3', // verify this file exists; rename if needed
      'Urgency.mp3',
    ],
    // MESSAGE TONES: full catalog
    allMessageTones: [
      'Default.mp3',
      'Dreamer.mp3',
      'Happy Message.mp3',
      'Notify.mp3',
      'Pop.mp3',                // fixed from .mp2
      'Pulsating Sound.mp3',
      'Text Message.mp3',
      'Vibrate.mp3',
      'Xylophone.mp3',
    ],

    // Free subsets (exactly 2 + 2 to match the UI)
    freeRingtones: ['Classic.mp3', 'Urgency.mp3'],
    freeMessageTones: ['Default.mp3', 'Vibrate.mp3'],
  },

  themes: {
    free: ['light', 'dark'],
    premium: ['amoled', 'neon', 'sunset', 'midnight', 'solarized'],
  },
};

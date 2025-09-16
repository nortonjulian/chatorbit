// LocalStorage keys
const LS_KEYS = {
  messageTone: 'sound:messageTone',
  ringtone: 'sound:ringtone',
  volume: 'sound:volume', // 0..1
};

// ===== Master libraries (filenames must exist in /public/sounds/...) =====
export const ALL_MESSAGE_TONES = [
  { label: 'Default',          value: 'Default.mp3' },
  { label: 'Dreamer',   value: 'Dreamer.mp3' },
  { label: 'Happy Message',          value: 'Happy Message.mp3' },
  { label: 'Notify',   value: 'Notify.mp3' },
  { label: 'Pop',   value: 'Pop.mp3' },
  { label: 'Pulsating Sound',   value: 'Pulsating Sound.mp3' },
  { label: 'Text Message',   value: 'Text Message.mp3' },
  { label: 'Vibrate',   value: 'Vibrate.mp3' },
  { label: 'Xylophone',   value: 'Xylophone.mp3' },
];

export const ALL_RINGTONES = [
  { label: 'Bells',   value: 'Bells.mp3' },
  { label: 'Classic', value: 'Classic.mp3' },
  { label: 'Chimes',   value: 'Chimes.mp3' },
  { label: 'Digital Phone',   value: 'Digital Phone.mp3' },
  { label: 'Melodic',   value: 'Melodic.mp3' },
  { label: 'Organ Notes',   value: 'Organ Notes.mp3' },
  { label: 'Sound Reality',   value: 'Sound Reality.mp3' },
  { label: 'Street',   value: 'Street.mp3' },
  { label: 'Universfield',   value: 'Universfield.mp3' },
  { label: 'Urgency',   value: 'Urgency.mp3' },
];

// ===== Free plan limits (exactly 3 + 3 as agreed) =====
const FREE_MESSAGE = ['Default.mp3', 'Vibrate.mp3'];
const FREE_RING    = ['Classic.mp3', 'Urgency.mp3'];

// ===== Defaults (use filenames that exist in the lists above) =====
export const DEFAULTS = {
  messageTone: 'Default.mp3',
  ringtone: 'Classic.mp3',
  volume: 0.7,
};

// ===== Plan-aware listings =====
export function listMessageTones(plan = 'FREE') {
  const p = String(plan || 'FREE').toUpperCase();
  return p === 'PREMIUM'
    ? ALL_MESSAGE_TONES
    : ALL_MESSAGE_TONES.filter((x) => FREE_MESSAGE.includes(x.value));
}

export function listRingtones(plan = 'FREE') {
  const p = String(plan || 'FREE').toUpperCase();
  return p === 'PREMIUM'
    ? ALL_RINGTONES
    : ALL_RINGTONES.filter((x) => FREE_RING.includes(x.value));
}

// ===== Local preference helpers =====
export function getMessageTone() {
  return localStorage.getItem(LS_KEYS.messageTone) || DEFAULTS.messageTone;
}
export function setMessageTone(filename) {
  localStorage.setItem(LS_KEYS.messageTone, filename);
}

export function getRingtone() {
  return localStorage.getItem(LS_KEYS.ringtone) || DEFAULTS.ringtone;
}
export function setRingtone(filename) {
  localStorage.setItem(LS_KEYS.ringtone, filename);
}

export function getVolume() {
  const v = parseFloat(localStorage.getItem(LS_KEYS.volume));
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULTS.volume;
}
export function setVolume(v) {
  const val = Math.min(1, Math.max(0, Number(v)));
  localStorage.setItem(LS_KEYS.volume, String(val));
}

// ===== URL resolvers (served by Vite from /public) =====
export function messageToneUrl(filename = getMessageTone()) {
  return `/sounds/Message_Tones/${filename}`;
}
export function ringtoneUrl(filename = getRingtone()) {
  return `/sounds/Ringtones/${filename}`;
}

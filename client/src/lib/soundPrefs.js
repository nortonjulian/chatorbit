// LocalStorage keys
const LS_KEYS = {
  messageTone: 'sound:messageTone',
  ringtone: 'sound:ringtone',
  volume: 'sound:volume', // 0..1
};

// ===== Master libraries (filenames must exist in /public/sounds/...) =====
export const ALL_MESSAGE_TONES = [
  { label: 'Default',          value: 'Default.mp3' },
  { label: 'Message Tone 1',   value: 'Message_Tone1.mp3' },
  { label: 'Message Tone 2',   value: 'Message_Tone2.mp3' },
  { label: 'Message Tone 3',   value: 'Message_Tone3.mp3' },
  { label: 'Message Tone 4',   value: 'Message_Tone4.mp3' },
  { label: 'Message Tone 5',   value: 'Message_Tone5.mp3' },
  { label: 'Message Tone 6',   value: 'Message_Tone6.mp3' },
  { label: 'Message Tone 7',   value: 'Message_Tone7.mp3' },
  { label: 'Message Tone 8',   value: 'Message_Tone8.mp3' },
  { label: 'Vibrate',          value: 'Vibrate.mp3' },
];

export const ALL_RINGTONES = [
  { label: 'Classic Ring', value: 'Classic.mp3' },
  { label: 'Ringtone 1',   value: 'Ringtone1.mp3' },
  { label: 'Ringtone 2',   value: 'Ringtone2.mp3' },
  { label: 'Ringtone 3',   value: 'Ringtone3.mp3' },
  { label: 'Ringtone 4',   value: 'Ringtone4.mp3' },
  { label: 'Ringtone 5',   value: 'Ringtone5.mp3' },
  { label: 'Ringtone 6',   value: 'Ringtone6.mp3' },
  { label: 'Ringtone 7',   value: 'Ringtone7.mp3' },
  { label: 'Ringtone 8',   value: 'Ringtone8.mp3' },
  { label: 'Ringtone 9',   value: 'Ringtone9.mp3' },
];

// ===== Free plan limits (exactly 3 + 3 as agreed) =====
const FREE_MESSAGE = ['Default.mp3', 'Message_Tone1.mp3', 'Message_Tone2.mp3'];
const FREE_RING    = ['Classic.mp3', 'Ringtone1.mp3', 'Ringtone2.mp3'];

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

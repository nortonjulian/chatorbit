// client/src/lib/soundPrefs.js

const LS_KEYS = {
  messageTone: 'sound:messageTone',
  ringtone: 'sound:ringtone',
  volume: 'sound:volume', // 0..1
};

// Curated lists (filenames must exist in public/sounds/*)
export const MESSAGE_TONES = [
  { label: 'Default', value: 'Default.mp3' },
  { label: 'Message Tone 1', value: 'Message_Tone1.mp3' },
  { label: 'Message Tone 2', value: 'Message_Tone2.mp3' },
  { label: 'Message Tone 3', value: 'Message_Tone3.mp3' },
  { label: 'Message Tone 4', value: 'Message_Tone4.mp3' },
  { label: 'Message Tone 5', value: 'Message_Tone5.mp3' },
  { label: 'Message Tone 6', value: 'Message_Tone6.mp3' },
  { label: 'Message Tone 7', value: 'Message_Tone7.mp3' },
  { label: 'Message Tone 8', value: 'Message_Tone8.mp3' },
  { label: 'Vibrate', value: 'Vibrate.mp3' },
];

export const RINGTONES = [
  { label: 'Classic Ring', value: 'Classic.mp3' },
  { label: 'Ringtone 1', value: 'Ringtone1.mp3' },
  { label: 'Ringtone 2', value: 'Ringtone2.mp3' },
  { label: 'Ringtone 3', value: 'Ringtone3.mp3' },
  { label: 'Ringtone 4', value: 'Ringtone4.mp3' },
  { label: 'Ringtone 5', value: 'Ringtone5.mp3' },
  { label: 'Ringtone 6', value: 'Ringtone6.mp3' },
  { label: 'Ringtone 7', value: 'Ringtone7.mp3' },
  { label: 'Ringtone 8', value: 'Ringtone8.mp3' },
  { label: 'Ringtone 9', value: 'Ringtone9.mp3' },
];

export const DEFAULTS = {
  messageTone: 'default.mp3',
  ringtone: 'classic-ring.mp3',
  volume: 0.7,
};

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

/** Resolve URLs served by Vite from /public */
export function messageToneUrl(filename = getMessageTone()) {
  return `/sounds/Message_Tones/${filename}`;
}
export function ringtoneUrl(filename = getRingtone()) {
  return `/sounds/Ringtones/${filename}`;
}

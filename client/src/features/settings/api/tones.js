import axiosClient from '@/api/axiosClient';
import {
  listMessageTones,
  listRingtones,
  getMessageTone,
  getRingtone,
  setMessageTone,
  setRingtone,
} from '@/lib/soundPrefs';

// Try backend first; fall back to local catalog so the UI still works.
export async function fetchTones() {
  try {
    const { data } = await axiosClient.get('/features/tones');
    return data; // expected shape: { canUsePremium, catalog: { ringtone:[{id,premium}], messageTone:[{id,premium}] }, current:{ ringtone, messageTone } }
  } catch {
    // 🛟 Fallback: build a local catalog from soundPrefs
    const freeMsg = listMessageTones('FREE');
    const proMsg = listMessageTones('PREMIUM').filter((x) => !freeMsg.includes(x));

    const freeRing = listRingtones('FREE');
    const proRing = listRingtones('PREMIUM').filter((x) => !freeRing.includes(x));

    return {
      canUsePremium: false,
      catalog: {
        messageTone: [
          ...freeMsg.map((id) => ({ id, premium: false })),
          ...proMsg.map((id) => ({ id, premium: true })),
        ],
        ringtone: [
          ...freeRing.map((id) => ({ id, premium: false })),
          ...proRing.map((id) => ({ id, premium: true })),
        ],
      },
      current: {
        messageTone: getMessageTone() || freeMsg[0] || null,
        ringtone: getRingtone() || freeRing[0] || null,
      },
    };
  }
}

// Persist selections to the server; if the endpoint isn’t ready yet, save locally as a fallback.
export async function updateTones({ ringtone, messageTone }) {
  try {
    const { data } = await axiosClient.post('/features/tones', { ringtone, messageTone });
    return data; // e.g. { ok:true }
  } catch {
    // 🛟 Fallback to local-only persistence
    if (messageTone) setMessageTone(messageTone);
    if (ringtone) setRingtone(ringtone);
    return { ok: true, localOnly: true };
  }
}

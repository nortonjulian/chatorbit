import * as prefs from '../src/utils/sounds';

describe('Sound preferences lists (plan-aware)', () => {
  test('listMessageTones filters free plan correctly', () => {
    const freeTones = prefs.listMessageTones('free').map(x => x.value);
    // Code’s spec: free = Default + Vibrate
    expect(freeTones).toEqual(['Default.mp3', 'Vibrate.mp3']);
    expect(prefs.listMessageTones('premium').length).toBe(prefs.ALL_MESSAGE_TONES.length);
  });

  test('listRingtones filters free plan correctly', () => {
    const freeRings = prefs.listRingtones(null).map(x => x.value);
    // Code’s spec: free = Classic + Urgency
    expect(freeRings).toEqual(['Classic.mp3', 'Urgency.mp3']);
    expect(prefs.listRingtones('PREMIUM').length).toBe(prefs.ALL_RINGTONES.length);
  });
});

describe('Sound preferences localStorage getters/setters', () => {
  beforeEach(() => localStorage.clear());

  test('getMessageTone returns default when not set', () => {
    expect(prefs.getMessageTone()).toBe(prefs.DEFAULTS.messageTone);
  });

  test('setMessageTone stores value', () => {
    // Use a known, non-default value to verify storage + retrieval
    prefs.setMessageTone('Vibrate.mp3');
    expect(localStorage.getItem('sound:messageTone')).toBe('Vibrate.mp3');
    expect(prefs.getMessageTone()).toBe('Vibrate.mp3');
  });

  test('getRingtone/setRingtone', () => {
    prefs.setRingtone('Urgency.mp3');
    expect(prefs.getRingtone()).toBe('Urgency.mp3');
  });

  test('getVolume returns default or clamped value', () => {
    expect(prefs.getVolume()).toBeCloseTo(prefs.DEFAULTS.volume);
    prefs.setVolume(1.5);
    expect(prefs.getVolume()).toBe(1);
    prefs.setVolume(-1);
    expect(prefs.getVolume()).toBe(0);
    prefs.setVolume(0.33);
    expect(prefs.getVolume()).toBeCloseTo(0.33);
  });

  test('URL helpers include correct path', () => {
    expect(prefs.messageToneUrl('tone.mp3')).toContain('/sounds/Message_Tones/tone.mp3');
    expect(prefs.ringtoneUrl('ring.mp3')).toContain('/sounds/Ringtones/ring.mp3');
  });
});

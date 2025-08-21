import * as prefs from '../src/lib/soundPrefs';

describe('Sound preferences lists (plan-aware)', () => {
  test('listMessageTones filters free plan correctly', () => {
    const freeTones = prefs.listMessageTones('free').map(x => x.value);
    expect(freeTones).toEqual(prefs.ALL_MESSAGE_TONES.filter(x => ['Default.mp3','Message_Tone1.mp3','Message_Tone2.mp3'].includes(x.value)).map(x => x.value));
    expect(prefs.listMessageTones('premium').length).toBe(prefs.ALL_MESSAGE_TONES.length);
  });
  test('listRingtones filters free plan correctly', () => {
    const freeRings = prefs.listRingtones(null).map(x => x.value);
    expect(freeRings).toEqual(['Classic.mp3','Ringtone1.mp3','Ringtone2.mp3']);
    expect(prefs.listRingtones('PREMIUM').length).toBe(prefs.ALL_RINGTONES.length);
  });
});

describe('Sound preferences localStorage getters/setters', () => {
  beforeEach(() => localStorage.clear());
  test('getMessageTone returns default when not set', () => {
    expect(prefs.getMessageTone()).toBe(prefs.DEFAULTS.messageTone);
  });
  test('setMessageTone stores value', () => {
    prefs.setMessageTone('TestTone.mp3');
    expect(localStorage.getItem('sound:messageTone')).toBe('TestTone.mp3');
    expect(prefs.getMessageTone()).toBe('TestTone.mp3');
  });
  test('getRingtone/setRingtone', () => {
    prefs.setRingtone('TestRing.mp3');
    expect(prefs.getRingtone()).toBe('TestRing.mp3');
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

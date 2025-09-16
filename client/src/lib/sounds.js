let unlocked = false;

/**
 * Call once after the first user interaction so browsers allow audio playback.
 * Tries the simplest "play a short file" first, then falls back to WebAudio.
 */
export function unlockAudio() {
  if (unlocked) return;

  // NOTE: match the exact case of the file that exists in /public/sounds/Message_Tones
  // Your catalog uses "Default.mp3", so use that here too.
  const probe = new Audio('/sounds/Message_Tones/Default.mp3');
  probe.volume = 0; // silent probe
  probe
    .play()
    .then(() => {
      probe.pause();
      probe.currentTime = 0;
      unlocked = true;
    })
    .catch(() => {
      // Approach 2: fallback to WebAudio unlock
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        osc.connect(ctx.destination);
        osc.start(0);
        osc.stop(0);
        unlocked = true;
      } catch {
        // ignore; will succeed after any later user gesture
      }
    });
}

/**
 * Fire-and-forget playback helper.
 * Returns the HTMLAudioElement so callers can pause/stop/loop control.
 */
export function playSound(src, { volume = 1.0, loop = false } = {}) {
  const el = new Audio(src);
  el.volume = Math.max(0, Math.min(1, volume));
  el.loop = !!loop;
  el.play().catch(() => {
    // Autoplay can still be blocked until a user gesture; safe to ignore.
  });
  return el;
}

/** Optional tiny helper to safely stop and reset an <audio> element */
export function stopSound(audioEl) {
  if (!audioEl) return;
  try {
    audioEl.pause();
    audioEl.currentTime = 0;
  } catch {}
}

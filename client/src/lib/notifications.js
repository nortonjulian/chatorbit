export function startTitleBlink(message = 'New message') {
  const base = document.title;
  let on = false;
  const id = setInterval(() => {
    document.title = on ? `❖ ${message}` : base;
    on = !on;
  }, 900);
  return () => { clearInterval(id); document.title = base; };
}

export async function webNotify({ title, body }) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch {}
  }
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

export function vibrate(pattern = [150, 50, 150]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

export function flashScreen() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const d = document.createElement('div');
  d.style.position = 'fixed'; d.style.inset = '0'; d.style.background = 'white'; d.style.opacity = '0.85';
  d.style.pointerEvents = 'none'; d.style.zIndex = '9999';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 220);
}

// Convenience: call on incoming msg/call if user prefers visual alerts
export function alertA11y({ title = 'ChatOrbit', body = '', vibrateOn = true, flashOn = false }) {
  webNotify({ title, body });
  if (vibrateOn) vibrate();
  if (flashOn) flashScreen();
}

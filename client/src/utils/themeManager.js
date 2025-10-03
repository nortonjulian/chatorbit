// import { ALL_THEMES } from '../config/themes';

// const LS_KEY = 'co-theme';
// const DEFAULT_THEME = 'light';

// export function getTheme() {
//   const t = localStorage.getItem(LS_KEY);
//   return ALL_THEMES.includes(t) ? t : DEFAULT_THEME; // all lowercase keys
// }

// export function applyTheme(name = getTheme()) {
//   // ensure lowercase keys only
//   document.documentElement.setAttribute('data-theme', name);
// }

// export function setTheme(name) {
//   const next = ALL_THEMES.includes(name) ? name : DEFAULT_THEME;
//   localStorage.setItem(LS_KEY, next);
//   applyTheme(next);
// }

// // optional: react to storage events across tabs
// export function onThemeChange(cb) {
//   const handler = (e) => {
//     if (e.key === LS_KEY) cb?.(getTheme());
//   };
//   window.addEventListener('storage', handler);
//   return () => window.removeEventListener('storage', handler);
// }


import { ALL_THEMES } from '../config/themes';

const LS_KEY_THEME = 'co-theme';
const LS_KEY_CTA   = 'co-cta';

/** ------- DEFAULT: branded dark (midnight) ------- */
const DEFAULT_THEME = 'midnight';

/** If you add new dark-like themes later, list them here */
const DARK_THEMES = new Set(['dark', 'midnight', 'amoled', 'neon']);

let current = null;
const subs = new Set();

/* ---------------- helpers ---------------- */
export function isLightTheme(themeName) {
  return themeName === 'light' || themeName === 'sunset' || themeName === 'solarized';
}

export function isDarkTheme(theme = getTheme()) {
  return DARK_THEMES.has(theme);
}

function coerce(theme) {
  return ALL_THEMES.includes(theme) ? theme : DEFAULT_THEME;
}

function notify(theme) {
  for (const fn of subs) fn(theme);
  window.dispatchEvent(new CustomEvent('chatforia:theme', { detail: { theme } }));
}

/* ---------------- public API ---------------- */
export function getTheme() {
  const t = localStorage.getItem(LS_KEY_THEME);
  return coerce(t);
}

export function applyTheme(theme = getTheme()) {
  current = theme;
  const html = document.documentElement;
  html.setAttribute('data-theme', theme);
  // Hint for libs that read a generic scheme flag
  html.setAttribute('data-color-scheme', isLightTheme(theme) ? 'light' : 'dark');
  notify(theme);
}

export function setTheme(theme) {
  const next = coerce(theme);
  if (next === current) return;
  try { localStorage.setItem(LS_KEY_THEME, next); } catch {}
  applyTheme(next);
}

/** Subscribe to theme changes in *this* tab. Returns an unsubscribe fn. */
export function onThemeChange(cb) {
  subs.add(cb);
  Promise.resolve().then(() => cb(getTheme()));
  return () => subs.delete(cb);
}

/* ---------------- CTA style helpers (optional) ---------------- */
export function setCTAStyle(mode /* 'warm' | 'cool' */) {
  document.documentElement.setAttribute('data-cta', mode);
  try { localStorage.setItem(LS_KEY_CTA, mode); } catch {}
}

export function getCTAStyle() {
  return localStorage.getItem(LS_KEY_CTA) || '';
}

/* ---------------- global wiring (call-once IIFE) ----------------
   - set initial theme (defaults to midnight)
   - keep tabs in sync
   - map system light/dark only if user is on those generic modes
----------------------------------------------------------------- */
(function wireGlobal() {
  // 1) apply initial theme before app renders
  applyTheme(getTheme());

  // 2) restore CTA style if previously set
  const savedCTA = getCTAStyle();
  if (savedCTA) document.documentElement.setAttribute('data-cta', savedCTA);

  // 3) cross-tab sync
  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY_THEME) applyTheme(getTheme());
    if (e.key === LS_KEY_CTA) {
      const v = getCTAStyle();
      if (v) document.documentElement.setAttribute('data-cta', v);
      else document.documentElement.removeAttribute('data-cta');
    }
  });

  // 4) follow system only when using generic light/dark themes
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (mq) {
    mq.addEventListener('change', () => {
      const t = getTheme();
      if (t === 'light' || t === 'dark') {
        setTheme(mq.matches ? 'dark' : 'light');
      }
    });
  }
})();

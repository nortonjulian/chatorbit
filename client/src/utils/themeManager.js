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

const LS_KEY = 'co-theme';
const DEFAULT_THEME = 'light';

// If you add new themes later, list which are "dark-like" here:
const DARK_THEMES = new Set(['dark', 'midnight', 'amoled']);

let current = null;
const subs = new Set();

export function getTheme() {
  const t = localStorage.getItem(LS_KEY);
  return ALL_THEMES.includes(t) ? t : DEFAULT_THEME;
}

export function isDarkTheme(theme = getTheme()) {
  return DARK_THEMES.has(theme);
}

function notify(theme) {
  for (const fn of subs) fn(theme);
  // also emit a DOM event if you prefer listening without importing this module
  window.dispatchEvent(new CustomEvent('chatforia:theme', { detail: { theme } }));
}

export function applyTheme(theme = getTheme()) {
  current = theme;
  document.documentElement.setAttribute('data-theme', theme);
  notify(theme);
}

export function setTheme(theme) {
  const next = ALL_THEMES.includes(theme) ? theme : DEFAULT_THEME;
  if (next === current) return; // no-op
  localStorage.setItem(LS_KEY, next);
  applyTheme(next); // updates DOM + notifies this tab immediately
}

/**
 * Subscribe to theme changes in *this* tab.
 * Returns an unsubscribe function.
 */
export function onThemeChange(cb) {
  subs.add(cb);
  // call once immediately with current theme so callers sync on mount
  Promise.resolve().then(() => cb(getTheme()));
  return () => subs.delete(cb);
}

/**
 * Optional: keep in sync with other tabs + system preference
 * Call once at app startup (you already call applyTheme(); keep that too).
 */
(function wireGlobalListeners() {
  // Cross-tab sync via localStorage
  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY) applyTheme(getTheme());
  });

  // System theme listener (maps only if your current theme is light/dark)
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

// utils/themeManager.js (add)
export function setCTAStyle(mode /* 'warm' | 'cool' */) {
  document.documentElement.setAttribute('data-cta', mode);
  try { localStorage.setItem('co-cta', mode); } catch {}
}

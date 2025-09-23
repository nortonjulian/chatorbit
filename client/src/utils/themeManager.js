import { ALL_THEMES } from '../config/themes';

const LS_KEY = 'co-theme';           // ← align with main.jsx’s existing key
const DEFAULT_THEME = 'light';

export function getTheme() {
  const t = localStorage.getItem(LS_KEY);
  return ALL_THEMES.includes(t) ? t : DEFAULT_THEME;
}

export function applyTheme(name = getTheme()) {
  document.documentElement.setAttribute('data-theme', name);
}

export function setTheme(name) {
  const next = ALL_THEMES.includes(name) ? name : DEFAULT_THEME;
  localStorage.setItem(LS_KEY, next);
  applyTheme(next);
}

/** Optional: allow others to react to changes (storage events from other tabs). */
export function onThemeChange(cb) {
  const handler = (e) => {
    if (e.key === LS_KEY) cb?.(getTheme());
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

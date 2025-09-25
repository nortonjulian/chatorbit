import { ALL_THEMES } from '../config/themes';

const LS_KEY = 'co-theme';
const DEFAULT_THEME = 'light';

export function getTheme() {
  const t = localStorage.getItem(LS_KEY);
  return ALL_THEMES.includes(t) ? t : DEFAULT_THEME; // all lowercase keys
}

export function applyTheme(name = getTheme()) {
  // ensure lowercase keys only
  document.documentElement.setAttribute('data-theme', name);
}

export function setTheme(name) {
  const next = ALL_THEMES.includes(name) ? name : DEFAULT_THEME;
  localStorage.setItem(LS_KEY, next);
  applyTheme(next);
}

// optional: react to storage events across tabs
export function onThemeChange(cb) {
  const handler = (e) => {
    if (e.key === LS_KEY) cb?.(getTheme());
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export const THEME_CATALOG = {
  free: ['Light', 'Dark'],
  premium: ['amoled', 'neon', 'sunset', 'midnight', 'solarized'],
};

export const ALL_THEMES = [...THEME_CATALOG.free, ...THEME_CATALOG.premium];

export function isPremiumTheme(name) {
  return THEME_CATALOG.premium.includes(name);
}

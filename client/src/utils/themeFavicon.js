const DARK_SET = new Set(['dark', 'midnight', 'amoled', 'neon']);

export function installThemeFaviconObserver() {
  const link = document.querySelector('#cf-favicon');
  if (!link) return;

  let lastIsDark = null;

  const apply = () => {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const isDark = DARK_SET.has(theme);
    if (isDark === lastIsDark) return; // avoid swaps during cycling within the same dark family

    link.href = isDark ? '/brand/favicon-dark.svg' : '/brand/favicon-light.svg';
    lastIsDark = isDark;
  };

  apply();
  const obs = new MutationObserver(apply);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // If your app also follows system, keep it in sync:
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  mq?.addEventListener?.('change', apply);
}

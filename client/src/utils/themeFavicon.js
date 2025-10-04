const DARK_SET = new Set(['dark', 'midnight', 'amoled', 'neon']);

function ensureFaviconLink() {
  let link = document.querySelector('#cf-favicon');
  if (!link) {
    link = document.createElement('link');
    link.id = 'cf-favicon';
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  return link;
}

export function installThemeFaviconObserver() {
  const link = ensureFaviconLink();
  let lastKey = '';

  const render = () => {
    const html = document.documentElement;
    const theme = html.getAttribute('data-theme') || 'dawn';
    const schemeAttr = html.getAttribute('data-color-scheme'); // 'light' | 'dark'
    const isDark = schemeAttr ? schemeAttr === 'dark' : DARK_SET.has(theme);

    const cs = getComputedStyle(html);
    const s1 = (cs.getPropertyValue('--logo-stop-1') || '').trim();
    const s2 = (cs.getPropertyValue('--logo-stop-2') || '').trim();
    const s3 = (cs.getPropertyValue('--logo-stop-3') || '').trim();

    // Fallback to static asset if stops missing
    if (!s1 || !s2 || !s3) {
      link.href = isDark ? '/brand/favicon-dark.svg' : '/brand/favicon-light.svg';
      return;
    }

    const key = `${theme}|${s1}|${s2}|${s3}|transparent`;
    if (key === lastKey) return;

    // Geometry: upright C (gap at 3 o’clock)
    const S = 128;
    const strokeW = 18;
    const r = (S / 2) - (strokeW / 2) - 6;
    const C = 2 * Math.PI * r;
    const gapDeg = 74;
    const dashOn  = C * ((360 - gapDeg) / 360);
    const dashOff = C * (gapDeg / 360);
    const dashOffset = -(dashOff / 2);

    // Halo to keep contrast on any tab background
    const halo = isDark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.18)';

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0%" stop-color="${s1}"/><stop offset="60%" stop-color="${s2}"/><stop offset="100%" stop-color="${s3}"/></linearGradient></defs>` +
      // halo stroke (slightly wider, semi-transparent)
      `<circle cx="${S/2}" cy="${S/2}" r="${r}" fill="none" stroke="${halo}" stroke-width="${strokeW + 3}" stroke-linecap="round" ` +
      `stroke-dasharray="${dashOn} ${dashOff}" stroke-dashoffset="${dashOffset}"/>` +
      // gradient C
      `<circle cx="${S/2}" cy="${S/2}" r="${r}" fill="none" stroke="url(#g)" stroke-width="${strokeW}" stroke-linecap="round" ` +
      `stroke-dasharray="${dashOn} ${dashOff}" stroke-dashoffset="${dashOffset}"/>` +
      `</svg>`;

    link.href = 'data:image/svg+xml;base64,' + btoa(svg);
    lastKey = key;
  };

  render();

  // Re-render on theme flips or scheme changes
  const obs = new MutationObserver(render);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-color-scheme'] });
  window.addEventListener('chatforia:theme', render);
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  mq?.addEventListener?.('change', render);
}

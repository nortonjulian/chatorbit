import { useEffect, useState } from 'react';

const DARK_THEMES = new Set(['dark', 'midnight', 'amoled', 'neon']);

export default function BrandLockup({
  className = '',
  logoSize = 64,          // bump default for the hero
  wordmark = 'Chatforia',
  gradientWordmark = true // keeps the gradient wordmark you styled in CSS
}) {
  const [theme, setTheme] = useState(
    document.documentElement.getAttribute('data-theme') || 'light'
  );

  useEffect(() => {
    const html = document.documentElement;
    const update = () => setTheme(html.getAttribute('data-theme') || 'light');
    const obs = new MutationObserver(update);
    obs.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    update();
    return () => obs.disconnect();
  }, []);

  // If you later want a different asset in dark themes, swap here based on `theme`.
  const src = '/brand/ppog.png'; // or '/brand/chameleon.png'

  return (
    <div
      className={`brand-lockup ${className}`}
      style={{ '--logo-size': `${logoSize}px` }}
    >
      <img
        src={src}
        alt="Chatforia logo"
        className="brand-lockup__logo"
        // IMPORTANT: no width/height props, no inline size here
      />
      <h1 className={`brand-lockup__name ${gradientWordmark ? 'text-blue-purple bp-wordmark' : ''}`}>
        {wordmark}
      </h1>
    </div>
  );
}

import { useEffect, useState } from 'react';
import LogoAdaptive from './LogoAdaptive.jsx';

const DARK_THEMES = new Set(['dark', 'midnight', 'amoled', 'neon']);

export default function BrandLockup({
  className = '',
  logoSize = 44,
  mode = 'adaptive',      // 'adaptive' | 'static-light' | 'static-dark'
  wordmark = 'Chatforia',
  gradientWordmark = true // uses your existing .text-blue-purple helper
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

  // Decide asset for static modes
  const staticSrc =
    mode === 'static-dark' || (mode === 'static-auto' && DARK_THEMES.has(theme))
      ? '/brand/chatforia-mark-white.svg'
      : '/brand/chatforia-mark-gradient.svg';

  return (
    <div className={`brand-lockup ${className}`}>
      {mode === 'adaptive' ? (
        <LogoAdaptive size={logoSize} />
      ) : (
        <img
          src={staticSrc}
          alt="Chatforia"
          width={logoSize}
          height={logoSize}
          className="brand-lockup__logo"
          style={{ width: logoSize, height: logoSize }}
        />
      )}
      <h1 className={`brand-lockup__name ${gradientWordmark ? 'text-blue-purple bp-wordmark' : ''}`}>
        {wordmark}
      </h1>
    </div>
  );
}

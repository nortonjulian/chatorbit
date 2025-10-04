import React from 'react';

/**
 * Upright gradient "C" + solid "hatforia", with precise baseline alignment.
 *
 * Props:
 *  - size: total pixel size of the C (default 96)
 *  - weight: stroke thickness as a fraction of size (default 0.18 = lighter)
 *  - gapDeg: opening size of the C in degrees (default 60)
 *  - gapCenterDeg: where the opening faces (0 = right / 3 o’clock)
 *  - gapRem: space between C and word (rem)
 *  - baselineEm: vertical-align adjustment in em for the C (negative raises it)
 *  - name: text to render to the right (default "hatforia")
 */
export default function BrandWordmark({
  size = 96,
  weight = 0.18,
  gapDeg = 60,
  gapCenterDeg = 0,
  gapRem = 0.24,
  baselineEm = -0.12,
  name = 'hatforia',
  className = '',
}) {
  const S = size;
  const sw = Math.max(8, Math.round(S * weight)); // thinner by default
  const r  = (S / 2) - (sw / 2) - 6;
  const C  = 2 * Math.PI * r;

  // Stroke-dash to create the opening
  const dashOn   = C * ((360 - gapDeg) / 360);
  const dashOff  = C * (gapDeg / 360);
  const offset   = (C * (gapCenterDeg / 360)) - (dashOff / 2);

  // Read theme-driven gradient stops (fallbacks if missing)
  const cs = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement)
    : null;
  const s1 = (cs?.getPropertyValue('--logo-stop-1') || '#FFB300').trim();
  const s2 = (cs?.getPropertyValue('--logo-stop-2') || '#FF8A00').trim();
  const s3 = (cs?.getPropertyValue('--logo-stop-3') || '#FF6F61').trim();

  const gid = React.useId().replace(/:/g, '');
  const namePx = Math.round(S * 0.56); // keep the word slightly smaller than C

  return (
    <div
      className={`brand-wordmark ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',     // baseline alignment between SVG (via vertical-align) and text
        gap: `${gapRem}rem`,
      }}
      aria-label="Chatforia"
    >
      <svg
        width={S}
        height={S}
        viewBox={`0 0 ${S} ${S}`}
        role="img"
        aria-hidden="true"
        style={{
          // The key to perfect alignment across browsers:
          verticalAlign: `${baselineEm}em`, // negative raises the C
          shapeRendering: 'geometricPrecision',
        }}
      >
        <defs>
          <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor={s1} />
            <stop offset="60%"  stopColor={s2} />
            <stop offset="100%" stopColor={s3} />
          </linearGradient>
        </defs>

        {/* Upright C with opening facing right */}
        <circle
          cx={S / 2}
          cy={S / 2}
          r={r}
          fill="none"
          stroke={`url(#g-${gid})`}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${dashOn} ${dashOff}`}
          strokeDashoffset={offset}
        />
      </svg>

      <span
        style={{
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial',
          fontWeight: 800,
          fontSize: `${namePx}px}`,
          lineHeight: 1,
          letterSpacing: '-0.015em',
          color: 'var(--fg)',
        }}
      >
        {name}
      </span>
    </div>
  );
}

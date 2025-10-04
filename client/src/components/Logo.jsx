// Clean, path-based 270° arc "C" that always opens to the RIGHT.
export default function LogoC({
  size = 64,
  stroke = Math.max(10, Math.round(size / 6)),
  rotateDeg = 0,                // keep 0 so opening is to the RIGHT
  className,
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = (size - stroke) / 2;

  // Draw a 270° arc from 45° to 315° (gap centered at 0° / right)
  const toRad = (deg) => (deg * Math.PI) / 180;
  const a1 = toRad(45);
  const a2 = toRad(315);

  const sx = cx + r * Math.cos(a1);
  const sy = cy + r * Math.sin(a1);
  const ex = cx + r * Math.cos(a2);
  const ey = cy + r * Math.sin(a2);

  // Large-arc-flag=1 (>=180°), sweep=1 (clockwise)
  const d = `M ${sx} ${sy} A ${r} ${r} 0 1 1 ${ex} ${ey}`;

  // Unique-ish gradient id to avoid collisions if multiple logos render
  const gid = `cGrad-${size}-${stroke}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role="img"
      aria-label="Chatforia C"
      style={{ transform: `rotate(${rotateDeg}deg)` }}  // keep 0; set -90 if you ever need to
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="var(--logo-stop-1)" />
          <stop offset="60%"  stopColor="var(--logo-stop-2)" />
          <stop offset="100%" stopColor="var(--logo-stop-3)" />
        </linearGradient>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </svg>
  );
}

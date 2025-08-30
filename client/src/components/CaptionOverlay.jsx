import React from 'react';

const FONT_MAP = { sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl' };

export default function CaptionOverlay({
  segments = [],
  font = 'lg',
  bg = 'dark',
  className = ''
}) {
  const text = segments.slice(-3).map(s => s.text).join(' ');
  const fontCls = FONT_MAP[font] || FONT_MAP.lg;
  const bgCls = bg === 'dark' ? 'bg-black/70 text-white' : bg === 'light' ? 'bg-white/90 text-black' : 'bg-transparent text-white drop-shadow'
  return (
    <div className={`pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[90%] ${className}`}>
      <div className={`rounded-2xl px-3 py-2 ${fontCls} ${bgCls}`}>{text || '…'}</div>
    </div>
  );
}
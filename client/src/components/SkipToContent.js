export default function SkipToContent({ targetId = 'main-content', label = 'Skip to content' }) {
  const base = {
    position: 'absolute',
    left: '8px',
    top: '8px',
    padding: '8px 12px',
    background: '#000',
    color: '#fff',
    zIndex: 9999,
    transform: 'translateY(-200%)',
    transition: 'transform .15s',
  };
  const onFocus = (e) => { e.currentTarget.style.transform = 'translateY(0%)'; };
  const onBlur  = (e) => { e.currentTarget.style.transform = 'translateY(-200%)'; };

  return (
    <a
      href={`#${targetId}`}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={(e) => {
        const el = document.getElementById(targetId);
        if (el) { el.tabIndex = -1; el.focus(); }
      }}
      style={base}
    >
      {label}
    </a>
  );
}

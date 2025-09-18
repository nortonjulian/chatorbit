export function ariaProps({
  label,
  labelledBy,
  describedBy,
  controls,
  expanded,
  selected,
  pressed,
  hidden,
} = {}) {
  const out = {};
  if (label) out['aria-label'] = label;
  if (labelledBy) out['aria-labelledby'] = labelledBy;
  if (describedBy) out['aria-describedby'] = describedBy;
  if (controls) out['aria-controls'] = controls;
  if (expanded != null) out['aria-expanded'] = !!expanded;
  if (selected != null) out['aria-selected'] = !!selected;
  if (pressed != null) out['aria-pressed'] = !!pressed;
  if (hidden != null) out['aria-hidden'] = !!hidden;
  return out;
}

/** trap focus within a container (for modals/popovers) */
export function trapFocus(container) {
  if (!container) return () => {};
  const focusable = container.querySelectorAll(
    [
      'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
      'input:not([type="hidden"]):not([disabled])', 'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',')
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  function handler(e) {
    if (e.key !== 'Tab') return;
    if (!focusable.length) { e.preventDefault(); return; }
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  container.addEventListener('keydown', handler);
  return () => container.removeEventListener('keydown', handler);
}

/** use on non-button elements to make them act like buttons (Enter/Space) */
export function safeButtonProps(onActivate, { disabled = false, role = 'button' } = {}) {
  return {
    role,
    tabIndex: disabled ? -1 : 0,
    'aria-disabled': disabled || undefined,
    onKeyDown: (e) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate?.(e); }
    },
    onClick: (e) => { if (!disabled) onActivate?.(e); },
  };
}

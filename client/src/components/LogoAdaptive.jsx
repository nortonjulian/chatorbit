/**
 * Adaptive Chatforia logo:
 * - Uses CSS mask with your silhouette to fill with var(--cta-gradient)
 * - Changes automatically when data-theme flips or cycling is on
 * - "Translucent" look via optional opacity + blend mode
 */
export default function LogoAdaptive({
  size = 44,
  title = 'Chatforia',
  translucent = true,  // makes it feel glassy on gradients
  className = '',
  style = {},
  ...rest
}) {
  const px = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      role="img"
      aria-label={title}
      className={className}
      style={{
        width: px,
        height: px,
        display: 'inline-block',
        background: 'var(--cta-gradient)',        // follows theme/cycling
        WebkitMaskImage: 'url("/brand/chatforia-mask.svg")',
        maskImage: 'url("/brand/chatforia-mask.svg")',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        borderRadius: 8,
        // translucent “overlay” feel
        opacity: translucent ? 0.95 : 1,
        mixBlendMode: translucent ? 'screen' : 'normal', // looks great on dark/gradients
        ...style,
      }}
      {...rest}
    />
  );
}

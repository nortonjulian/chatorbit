import { Group, Image, Title } from '@mantine/core';
import '../styles.css';

export default function BrandLockup({ size = 'md', className = '' }) {
  // Tuned sizes (you set md to 60/28)
  const sizes = {
    sm: { logo: 28, text: 18 },
    md: { logo: 60, text: 28 },
    lg: { logo: 72, text: 36 },
  };
  const { logo, text } = sizes[size] || sizes.md;

  return (
    <Group
      gap="sm"
      align="center"
      wrap="nowrap"
      className={`brand-lockup ${className}`}
      style={{ '--logo-size': `${logo}px`, '--text-size': `${text}px` }}
    >
      <Image
        src="/logo-blank.png"
        alt="ChatOrbit"
        className="brand-lockup__logo"
        fit="contain"
      />
      {/* IMPORTANT: remove `c="orbit.8"` so CSS gradient can apply */}
      <Title order={3} className="brand-lockup__name">
        ChatOrbit
      </Title>
    </Group>
  );
}

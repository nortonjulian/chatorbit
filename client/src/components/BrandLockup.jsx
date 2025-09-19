import { Group, Image, Title } from '@mantine/core';

export default function BrandLockup({ size = 'md' }) {
  const sizes = {
    sm: { logo: 28, text: 18 },
    md: { logo: 44, text: 24 },
    lg: { logo: 56, text: 32 }, // bigger proportion
  };

  const { logo, text } = sizes[size] || sizes.md;

  return (
    <Group gap="sm" align="center" wrap="nowrap" className="brand-lockup">
      <Image
        src="/logo-chatorbit.png"
        alt="ChatOrbit logo"
        h={logo}
        fit="contain"
      />
      <Title order={3} c="orbit.8" style={{ fontSize: text, margin: 0 }}>
        ChatOrbit
      </Title>
    </Group>
  );
}

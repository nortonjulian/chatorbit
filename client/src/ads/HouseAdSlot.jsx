import { Card, Group, Text, Button, Image } from '@mantine/core';
import { ADS_CONFIG } from './config';
import { useNavigate } from 'react-router-dom';

export default function HouseAdSlot({ placement, style }) {
  const nav = useNavigate();
  const pool = ADS_CONFIG.house[placement] || [];
  const creative = pool[0]; // rotate if you want

  if (!creative) return null;

  if (creative.kind === 'image') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', ...style }}>
        <a href={creative.href} target="_blank" rel="noreferrer">
          <Image src={creative.img} alt="Advertisement" radius="md" />
        </a>
      </div>
    );
  }

  // card/text default
  return (
    <Card withBorder radius="lg" p="md" style={style}>
      <Group justify="space-between" align="center">
        <div>
          <Text fw={600}>{creative.title}</Text>
          {creative.body ? <Text c="dimmed" size="sm">{creative.body}</Text> : null}
        </div>
        <Button onClick={() => (creative.href?.startsWith('/') ? nav(creative.href) : window.open(creative.href, '_blank'))}>
          {creative.cta || 'Learn more'}
        </Button>
      </Group>
    </Card>
  );
}

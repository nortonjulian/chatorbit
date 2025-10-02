import { Card, Text, Button, Group } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

export default function UpgradeCard() {
  const nav = useNavigate();
  return (
    <Card withBorder padding="md" radius="lg">
      <Group justify="space-between" align="center">
        <div>
          <Text fw={600}>Enjoy Chatforia ad-free</Text>
          <Text size="sm" c="dimmed">Upgrade to Premium to remove ads and unlock extra features.</Text>
        </div>
        <Button onClick={() => nav('/settings/upgrade')} variant="light">
          Upgrade
        </Button>
      </Group>
    </Card>
  );
}

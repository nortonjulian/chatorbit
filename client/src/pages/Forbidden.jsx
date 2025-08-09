import { Title, Text } from '@mantine/core';
export default function Forbidden() {
  return (
    <div>
      <Title order={3}>403 — Forbidden</Title>
      <Text c="dimmed">You don’t have permission to view this page.</Text>
    </div>
  );
}

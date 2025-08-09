import { Outlet } from 'react-router-dom';
import { Title, Text, Stack, Paper } from '@mantine/core';

export default function AdminLayout() {
  return (
    <Paper p="lg" radius="xl" withBorder>
      <Stack>
        <Title order={3}>Admin</Title>
        <Text c="dimmed" size="sm">
          Restricted tools for moderators and administrators.
        </Text>
        <Outlet />
      </Stack>
    </Paper>
  );
}

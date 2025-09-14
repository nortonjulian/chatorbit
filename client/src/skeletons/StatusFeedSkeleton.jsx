import { Stack, Paper, Group, Skeleton } from '@mantine/core';

export default function StatusFeedSkeleton({ count = 6 }) {
  return (
    <Stack>
      {Array.from({ length: count }).map((_, i) => (
        <Paper key={i} withBorder radius="lg" p="md">
          <Group gap="sm" align="center">
            <Skeleton height={40} circle />
            <Stack gap={4} style={{ flex: 1 }}>
              <Skeleton height={12} width="30%" />
              <Skeleton height={10} width="20%" />
            </Stack>
          </Group>
          <Skeleton height={8} mt="md" />
          <Skeleton height={8} mt={6} width="80%" />
        </Paper>
      ))}
    </Stack>
  );
}

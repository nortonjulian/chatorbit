import { Paper, Stack, Text, Button, Group } from '@mantine/core';

export default function EmptyState({ title, subtitle, cta, onCta }) {
  return (
    <Paper withBorder radius="lg" p="xl">
      <Stack gap="xs" align="center">
        <Text fw={700} size="lg">{title || 'Nothing here yet'}</Text>
        {subtitle ? <Text c="dimmed" ta="center">{subtitle}</Text> : null}
        {cta ? (
          <Group mt="sm">
            <Button onClick={onCta} aria-label={cta}>{cta}</Button>
          </Group>
        ) : null}
      </Stack>
    </Paper>
  );
}

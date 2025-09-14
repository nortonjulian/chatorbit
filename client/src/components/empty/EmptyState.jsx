import { Center, Stack, Text, Button } from '@mantine/core'

export default function EmptyState({ title, subtitle, cta, onCta }) {
  return (
    <Center mih={240} p="lg">
      <Stack gap="xs" align="center">
        <Text fw={700}>{title}</Text>
        {subtitle && <Text c="dimmed" ta="center">{subtitle}</Text>}
        {cta && <Button onClick={onCta} variant="light">{cta}</Button>}
      </Stack>
    </Center>
  )
}

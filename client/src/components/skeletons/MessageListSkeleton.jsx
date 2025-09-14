import { Stack, Skeleton, Group } from '@mantine/core'
export default function MessageListSkeleton() {
  return (
    <Stack gap="md" p="md">
      {Array.from({ length: 10 }).map((_, i) => (
        <Group key={i} justify={i % 2 ? 'flex-end' : 'flex-start'}>
          <Skeleton height={18} width={i % 2 ? 220 : 280} radius="lg" />
        </Group>
      ))}
    </Stack>
  )
}

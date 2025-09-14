import { Stack, Skeleton } from '@mantine/core'
export default function ChatListSkeleton() {
  return (
    <Stack gap="sm" p="sm">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} height={48} radius="md" />
      ))}
    </Stack>
  )
}

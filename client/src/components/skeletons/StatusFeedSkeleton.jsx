import { SimpleGrid, Skeleton, Card } from '@mantine/core'
export default function StatusFeedSkeleton() {
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} p="md" spacing="md">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} withBorder radius="lg" p="md">
          <Skeleton height={120} radius="md" />
          <Skeleton height={14} mt="sm" width="60%" />
        </Card>
      ))}
    </SimpleGrid>
  )
}

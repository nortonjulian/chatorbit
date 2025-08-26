import { Group, Button } from '@mantine/core';

export default function SmartReplyBar({ suggestions = [], onPick }) {
  if (!suggestions.length) return null;
  return (
    <Group gap="xs" mt="xs" wrap="wrap">
      {suggestions.map((s, i) => (
        <Button
          key={i}
          size="xs"
          variant="light"
          onClick={() => onPick?.(s.text)}
        >
          {s.text}
        </Button>
      ))}
    </Group>
  );
}

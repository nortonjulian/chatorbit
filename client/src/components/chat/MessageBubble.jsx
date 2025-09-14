import { Tooltip, Group, Text, ActionIcon } from '@mantine/core'
import { RotateCw } from 'lucide-react' // or your icon
import dayjs from 'dayjs'

export default function MessageBubble({ msg, onRetry }) {
  const ts = dayjs(msg.createdAt).format('MMM D, YYYY • h:mm A')

  return (
    <Group justify={msg.mine ? 'flex-end' : 'flex-start'} wrap="nowrap" align="flex-end" px="md">
      <Tooltip label={ts} withinPortal>
        <Text
          role="text"
          aria-label={`Message sent ${ts}`}
          px="md"
          py={8}
          maw="68%"
          c={msg.mine ? 'white' : 'black'}
          bg={msg.mine ? 'orbitBlue.6' : 'gray.1'}
          style={{ borderRadius: 18, wordBreak: 'break-word' }}
        >
          {msg.content}
        </Text>
      </Tooltip>

      {msg.failed && (
        <ActionIcon
          aria-label="Retry sending message"
          variant="subtle"
          onClick={() => onRetry?.(msg)}
          title="Retry"
        >
          <RotateCw />
        </ActionIcon>
      )}
    </Group>
  )
}

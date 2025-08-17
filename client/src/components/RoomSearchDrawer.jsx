import { useEffect, useState } from 'react';
import { Drawer, TextInput, Stack, ScrollArea, Text, Group, Badge } from '@mantine/core';
import { searchRoom } from '../utils/messagesStore';

export default function RoomSearchDrawer({ opened, onClose, roomId, onJump }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    setQ('');
    setResults([]);
  }, [opened, roomId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      const res = await searchRoom(roomId, q);
      if (alive) setResults(res.slice(-200)); // cap to avoid UI overload
    })();
    return () => {
      alive = false;
    };
  }, [q, roomId]);

  return (
    <Drawer opened={opened} onClose={onClose} title="Search in chat" position="right" size="md">
      <Stack gap="sm">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          placeholder="Search messages (local)"
        />
        <ScrollArea h={500}>
          <Stack gap="xs">
            {results.map((m) => (
              <Group
                key={m.id}
                onClick={() => onJump?.(m.id)}
                style={{ cursor: 'pointer' }}
                align="start"
              >
                <Badge variant="light">{new Date(m.createdAt).toLocaleString()}</Badge>
                <Text size="sm">
                  {(m.decryptedContent || m.translatedForMe || m.rawContent || '').slice(0, 240)}
                </Text>
              </Group>
            ))}
            {!results.length && q && <Text c="dimmed">No matches (in local cache)</Text>}
          </Stack>
        </ScrollArea>
      </Stack>
    </Drawer>
  );
}

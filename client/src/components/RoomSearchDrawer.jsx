import { useEffect, useState } from 'react';
import { Drawer, TextInput, Stack, ScrollArea, Text, Group, Badge, Divider } from '@mantine/core';
import { searchRoom } from '../utils/messagesStore';
import useIsPremium from '@/hooks/useIsPremium';
import { AdSlot } from '@/ads/AdSlot';
import { PLACEMENTS } from '@/ads/placements';

export default function RoomSearchDrawer({ opened, onClose, roomId, onJump }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const isPremium = useIsPremium();

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
      if (alive) setResults(Array.isArray(res) ? res.slice(-200) : []);
    })();
    return () => {
      alive = false;
    };
  }, [q, roomId]);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Search in room"
      position="right"
      size="md"
      radius="lg"
      aria-label="Search in room"
    >
      <Stack gap="sm">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          placeholder="Search messages"
          label="Search"
          autoFocus
        />

        <ScrollArea h={500}>
          <Stack gap="xs">
            {results.map((m) => {
              const text = (m.decryptedContent || m.translatedForMe || m.rawContent || '').slice(0, 240);
              const click = () => onJump?.(m.id);
              return (
                <Group key={m.id} style={{ cursor: 'pointer' }} align="start" onClick={click}>
                  <Badge variant="light">{new Date(m.createdAt).toLocaleString()}</Badge>
                  <Text size="sm">
                    <span onClick={click}>{text}</span>
                  </Text>
                </Group>
              );
            })}
            {!results.length && q && <Text c="dimmed">No results</Text>}
          </Stack>
        </ScrollArea>

        {/* Ad at the bottom of the drawer for Free tier only */}
        {!isPremium && (
          <>
            <Divider my="xs" />
            <AdSlot placement={PLACEMENTS.SEARCH_RESULTS_FOOTER} />
          </>
        )}
      </Stack>
    </Drawer>
  );
}

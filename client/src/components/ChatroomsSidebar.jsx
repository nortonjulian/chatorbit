import { useEffect, useState } from 'react';
import {
  Stack,
  Skeleton,
  Text,
  Button,
  Group,
  Alert,
  Badge,
  UnstyledButton,
} from '@mantine/core';
import { IconMessagePlus } from '@tabler/icons-react';
import axiosClient from '../api/axiosClient';

export default function ChatroomsSidebar({
  onStartNewChat,         // () => void
  onSelect,               // (room) => void
  hideEmpty = false,      // if true, render null when no rooms
  activeRoomId = null,    // highlight currently opened room
}) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setErr('');
        const res = await axiosClient.get('/rooms', {
          signal: ctrl.signal,
          // withCredentials not needed if axiosClient is already configured
        });
        if (!mounted) return;
        const data = res?.data;
        const list = Array.isArray(data) ? data : (data?.rooms || []);
        setRooms(list);
      } catch (e) {
        if (!mounted) return;
        if (e.name !== 'CanceledError') {
          setErr(
            e?.response?.data?.error ||
              e?.response?.data?.message ||
              e?.message ||
              'Failed to load chats'
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, []);

  if (loading) {
    return (
      <Stack p="sm" gap="sm">
        <Text fw={600}>Chatrooms</Text>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} height={46} radius="md" />
        ))}
      </Stack>
    );
  }

  if (err) {
    return (
      <Stack p="sm" gap="sm">
        <Text fw={600}>Chatrooms</Text>
        <Alert color="red" variant="light">{err}</Alert>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </Stack>
    );
  }

  if (!rooms.length) {
    if (hideEmpty) return null;
    return (
      <Stack p="sm" gap="sm">
        <Text fw={600}>Chatrooms</Text>
        <Text c="dimmed" size="sm">No conversations yet.</Text>
        <Button
          leftSection={<IconMessagePlus size={16} />}
          onClick={onStartNewChat}
        >
          New chat
        </Button>
      </Stack>
    );
  }

  return (
    <Stack p="sm" gap="xs">
      <Text fw={600}>Chatrooms</Text>

      {rooms.map((r) => {
        const title = r.title || r.name || r.displayName || `Room #${r.id}`;
        const unread = r.unreadCount || r._count?.unread || 0;

        return (
          <UnstyledButton
            key={r.id}
            onClick={() => onSelect?.(r)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 12,
              background:
                String(r.id) === String(activeRoomId) ? 'var(--mantine-color-gray-1)' : 'transparent',
            }}
          >
            <Group justify="space-between" wrap="nowrap">
              <Text truncate fw={500}>{title}</Text>
              {!!unread && <Badge size="sm" variant="light">{unread}</Badge>}
            </Group>
            {r.lastMessage?.content && (
              <Text size="sm" c="dimmed" lineClamp={1} mt={4}>
                {r.lastMessage.content}
              </Text>
            )}
          </UnstyledButton>
        );
      })}
    </Stack>
  );
}

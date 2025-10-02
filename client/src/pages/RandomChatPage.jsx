import { useEffect, useState, useCallback } from 'react';
import {
  Paper, Title, Text, Button, Group, Loader, TextInput, Stack, Badge, Card
} from '@mantine/core';
import { IconMessageCircle, IconPlayerPlay, IconPlayerStop, IconRobot } from '@tabler/icons-react';
import { useUser } from '@/context/UserContext';
import socket from '@/lib/socket'; // singleton client

export default function RandomChatPage() {
  const { currentUser } = useUser();
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(null); // { roomId, partner, partnerId }
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');

  // --- Socket listeners
  useEffect(() => {
    if (!socket) return;

    const onPairFound = (payload) => {
      setActive(payload);
      setSearching(false);
      setStatus('');
      setMessages([]);
    };
    const onReceiveMessage = (msg) => setMessages((p) => [...p, msg]);
    const onPartnerDisconnected = (txt) => setStatus(txt || 'Your partner disconnected.');
    const onChatSkipped = (txt) => {
      setSearching(false);
      setActive(null);
      setStatus(txt || 'Stopped.');
    };

    socket.on('pair_found', onPairFound);
    socket.on('receive_message', onReceiveMessage);
    socket.on('partner_disconnected', onPartnerDisconnected);
    socket.on('chat_skipped', onChatSkipped);

    return () => {
      socket.off('pair_found', onPairFound);
      socket.off('receive_message', onReceiveMessage);
      socket.off('partner_disconnected', onPartnerDisconnected);
      socket.off('chat_skipped', onChatSkipped);
    };
  }, []);

  // --- Actions
  const startSearch = () => {
    if (!socket || !currentUser) return;
    setSearching(true);
    setStatus('Looking for someone…');
    socket.emit('find_random_chat');
  };

  const startAIChat = () => {
    if (!socket) return;
    setSearching(true);
    setStatus('Starting an AI chat…');
    socket.emit('start_ai_chat');
  };

  const sendMessage = () => {
    if (!socket || !active || !draft.trim()) return;
    socket.emit('send_message', {
      content: draft.trim(),
      randomChatRoomId: active.roomId,
    });
    setDraft('');
  };

  // ✅ Always works: clears local state and tells the server to stop anything pending.
  const cancelAll = useCallback(() => {
    // Local UI reset first (instant feedback)
    setSearching(false);
    setActive(null);
    setMessages([]);
    setStatus('Cancelled.');

    // Tell server to remove from queue / leave active room if any
    try {
      socket?.emit?.('skip_random_chat');
    } catch {
      // ignore network errors; local UI already reset
    }
  }, []);

  // Bonus: ESC = Cancel
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') cancelAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelAll]);

  return (
    <Paper withBorder radius="xl" p="lg" maw={720} mx="auto">
      <Group justify="space-between" align="center">
        <Title order={3}>Random Chat</Title>
        {active ? (
          <Badge color="grape" variant="light">Connected</Badge>
        ) : searching ? (
          <Badge color="blue" variant="light">Searching…</Badge>
        ) : (
          <Badge color="gray" variant="light">Idle</Badge>
        )}
      </Group>

      {!active && (
        <Stack mt="md">
          <Text c="dimmed">
            Meet someone new instantly. We’ll match you and open a temporary chat room.
          </Text>

          <Group>
            <Button onClick={startSearch} leftSection={<IconPlayerPlay size={16} />}>
              {searching ? 'Finding…' : 'Find me a match'}
            </Button>
            {/* ✅ Always enabled now */}
            <Button
              variant="light"
              color="gray"
              onClick={cancelAll}
              leftSection={<IconPlayerStop size={16} />}
            >
              Cancel
            </Button>
            <Button variant="subtle" leftSection={<IconRobot size={16} />} onClick={startAIChat}>
              Try ForiaBot instead
            </Button>
          </Group>

          {status && (
            <Text c="dimmed">
              {searching && <Loader size="xs" style={{ marginRight: 6 }} />}
              {status}
            </Text>
          )}
        </Stack>
      )}

      {active && (
        <Stack mt="lg" gap="sm">
          <Card withBorder radius="lg" p="sm">
            <Group justify="space-between">
              <Group>
                <IconMessageCircle size={16} />
                <Text fw={600}>You’re chatting with {String(active.partner)}</Text>
              </Group>
              {/* Also leaves the room if active */}
              <Button color="red" variant="light" size="xs" onClick={cancelAll}>
                Leave
              </Button>
            </Group>
          </Card>

          <div style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 12, padding: 12, height: 360, overflow: 'auto' }}>
            {messages.length === 0 ? (
              <Text c="dimmed">Say hi 👋</Text>
            ) : (
              <Stack gap="xs">
                {messages.map((m, i) => (
                  <div key={i}>
                    <Text size="sm" fw={600}>
                      {m.sender?.username || (m.senderId === currentUser?.id ? 'You' : 'Partner')}
                    </Text>
                    <Text size="sm">{m.content}</Text>
                  </div>
                ))}
              </Stack>
            )}
          </div>

          <Group align="flex-end">
            <TextInput
              placeholder="Type a message"
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button onClick={sendMessage} disabled={!draft.trim()}>
              Send
            </Button>
          </Group>

          {status && <Text c="dimmed">{status}</Text>}
        </Stack>
      )}
    </Paper>
  );
}

import { useEffect, useRef, useState } from 'react';
import { ScrollArea, Stack, NavLink, Badge, Text, Box } from '@mantine/core';
import socket from '../lib/socket';

export default function ChatroomList({ onSelect, currentUser, selectedRoom }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const viewportRef = useRef(null);

  async function loadMore(initial = false) {
    if (loading || !currentUser?.id) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('limit', initial ? '50' : '30');
      if (cursor) qs.set('cursor', String(cursor));

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/chatrooms?${qs.toString()}`,
        {
          credentials: 'include',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch chatrooms');
      const data = await res.json(); // { items, nextCursor }
      setItems((prev) => (initial ? data.items : [...prev, ...data.items]));
      setCursor(data.nextCursor);
    } catch (e) {
      // optional: show a toast
      // console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // initial load / reload on user change
  useEffect(() => {
    setItems([]);
    setCursor(null);
    loadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // infinite scroll
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
      if (nearBottom && cursor && !loading) loadMore(false);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [cursor, loading]);

  const handleSelect = (room) => {
    if (!room) return;
    if (selectedRoom?.id) socket.emit('leave_room', selectedRoom.id);
    socket.emit('join_room', room.id);
    onSelect?.(room);
  };

  return (
    <Box>
      {items.length === 0 && !loading ? (
        <Text c="dimmed" size="sm">No chatrooms yet.</Text>
      ) : (
        <ScrollArea.Autosize
          mah="calc(100vh - 160px)"
          type="auto"
          viewportRef={viewportRef}
        >
          <Stack gap="xs" p={0}>
            {items.map((room) => {
              const isSelected = selectedRoom?.id === room.id;
              const roomName = room.name || `Room #${room.id}`;
              const isGroup = (room.participants?.length || 0) > 2;

              return (
                <NavLink
                  key={room.id}
                  label={roomName}
                  active={isSelected}
                  onClick={() => handleSelect(room)}
                  rightSection={
                    isGroup ? (
                      <Badge size="xs" variant="light" radius="sm">
                        Group
                      </Badge>
                    ) : null
                  }
                  variant="light"
                  radius="md"
                />
              );
            })}
            {loading && (
              <Text ta="center" c="dimmed" py="xs">Loading…</Text>
            )}
            {!cursor && items.length > 0 && (
              <Text ta="center" c="dimmed" py="xs">No more chats</Text>
            )}
          </Stack>
        </ScrollArea.Autosize>
      )}
    </Box>
  );
}

import { useEffect, useState } from 'react';
import { fetchChatrooms } from '../api/chatrooms';
import socket from '../lib/socket';
import { ScrollArea, Stack, NavLink, Badge, Text, Box } from '@mantine/core';

export default function ChatroomList({ onSelect, currentUser, selectedRoom }) {
  const [chatrooms, setChatrooms] = useState([]);

  useEffect(() => {
    const loadChatrooms = async () => {
      if (!currentUser?.id) return;
      const rooms = await fetchChatrooms(currentUser.id);
      setChatrooms(rooms);
    };
    loadChatrooms();
  }, [currentUser]);

  const handleSelect = (room) => {
    if (selectedRoom?.id) {
      socket.emit('leave_room', selectedRoom.id);
    }
    socket.emit('join_room', room.id);
    onSelect(room);
  };

  return (
    <Box>
      {chatrooms.length === 0 ? (
        <Text c="dimmed" size="sm">
          No chatrooms yet.
        </Text>
      ) : (
        <ScrollArea.Autosize mah="calc(100vh - 160px)" type="auto">
          <Stack gap="xs">
            {chatrooms.map((room) => {
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
          </Stack>
        </ScrollArea.Autosize>
      )}
    </Box>
  );
}

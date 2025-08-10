// src/components/ChatView.jsx
import { useEffect, useRef, useState } from 'react';
import { Box, Group, Avatar, Paper, Text, Button, Stack, ScrollArea, Title, Badge } from '@mantine/core';
import MessageInput from './MessageInput';
import socket from '../socket';
import { decryptFetchedMessages } from '../utils/encryptionClient';

function getTimeLeftString(expiresAt) {
  const now = Date.now();
  const expires = new Date(expiresAt).getTime();
  const diff = expires - now;
  if (diff <= 0) return 'Expired';
  const seconds = Math.floor(diff / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins > 0 ? `${mins}m ` : ''}${secs}s`;
}

function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}

export default function ChatView({ chatroom, currentUserId, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState('');
  const [showNewMessage, setShowNewMessage] = useState(false);

  const messagesEndRef = useRef(null);
  const scrollViewportRef = useRef(null); // Mantine ScrollArea viewport
  const now = useNow();

  const handleEditMessage = async (msg) => {
    const newText = prompt('Edit:', msg.rawContent || msg.content);
    if (!newText || newText === msg.rawContent) return;

    try {
      const res = await fetch(`http://localhost:5001/messages/${msg.id}/edit`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (!res.ok) throw new Error('Failed to edit');
      const updated = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? { ...m, rawContent: newText, content: newText } : m))
      );
    } catch (error) {
      alert('Message edit failed');
      console.log(error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowNewMessage(false);
  };

  useEffect(() => {
    if (!chatroom || !currentUserId) return;

    const fetchAndDecryptMessages = async () => {
      try {
        const res = await fetch(`http://localhost:5001/messages/${chatroom.id}?userId=${currentUserId}`);
        const data = await res.json();
        const decrypted = await decryptFetchedMessages(data, currentUserId);
        setMessages(decrypted);
        // Jump to bottom on initial load
        setTimeout(scrollToBottom, 0);
      } catch (err) {
        console.error('Failed to fetch/decrypt messages', err);
      }
    };

    fetchAndDecryptMessages();

    socket.emit('join_room', chatroom.id);

    const handleReceiveMessage = async (data) => {
      if (data.chatRoomId === chatroom.id) {
        try {
          const decryptedArr = await decryptFetchedMessages([data], currentUserId);
          const decrypted = decryptedArr[0];

          setMessages((prev) => [...prev, decrypted]);

          const v = scrollViewportRef.current;
          if (v && v.scrollTop + v.clientHeight >= v.scrollHeight - 10) {
            scrollToBottom();
          } else {
            setShowNewMessage(true);
          }
        } catch (e) {
          console.error('Failed to decrypt incoming message', e);
          // fallback: still append (encrypted) so UI shows *something*
          setMessages((prev) => [...prev, data]);
          setShowNewMessage(true);
        }
      }
    };

    const handleTyping = ({ username }) => setTypingUser(username);
    const handleStopTyping = () => setTypingUser('');

    socket.on('receive_message', handleReceiveMessage);
    socket.on('user_typing', handleTyping);
    socket.on('user_stopped_typing', handleStopTyping);

    return () => {
      socket.emit('leave_room', chatroom.id);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('user_typing', handleTyping);
      socket.off('user_stopped_typing', handleStopTyping);
    };
  }, [chatroom, currentUserId]);

  useEffect(() => {
    if (!messages.length || !currentUserId || !currentUser?.showReadReceipts) return;

    const unreadMessages = messages.filter(
      (msg) =>
        msg.sender?.id !== currentUserId &&
        !(msg.readBy?.some((u) => u.id === currentUserId))
    );

    unreadMessages.forEach((msg) => {
      fetch(`http://localhost:5001/messages/${msg.id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).catch((err) => console.error(`Failed to mark message ${msg.id} as read`, err));
    });
  }, [messages, currentUserId, currentUser]);

  if (!chatroom) {
    return (
      <Box p="md">
        <Title order={4} mb="xs">Select a chatroom</Title>
        <Text c="dimmed">Pick a chat on the left to get started.</Text>
      </Box>
    );
  }

  return (
    <Box p="md" h="100%" display="flex" style={{ flexDirection: 'column' }}>
      <Group mb="sm" justify="space-between">
        <Title order={4}>{chatroom?.name || 'Chat'}</Title>
        {chatroom?.participants?.length > 2 && (
          <Badge variant="light" radius="sm">Group</Badge>
        )}
      </Group>

      <ScrollArea
        style={{ flex: 1 }}
        viewportRef={scrollViewportRef}
        type="auto"
      >
        <Stack gap="xs" p="xs">
          {messages.map((msg) => {
            const isCurrentUser = msg.sender?.id === currentUserId;
            const expMs = msg.expiresAt ? new Date(msg.expiresAt).getTime() - now : null;
            const fading = msg.expiresAt && expMs <= 5000;

            const bubbleProps = isCurrentUser
              ? { bg: 'orbit.6', c: 'white', ta: 'right' }
              : { bg: 'gray.2', c: 'black', ta: 'left' };

            return (
              <Group
                key={msg.id}
                justify={isCurrentUser ? 'flex-end' : 'flex-start'}
                align="flex-end"
                wrap="nowrap"
                onPointerDown={(e) => {
                  const target = e.target;
                  const timeout = setTimeout(() => {
                    if (isCurrentUser && (msg.readBy?.length || 0) === 0) handleEditMessage(msg);
                  }, 600);
                  target.onpointerup = () => clearTimeout(timeout);
                  target.onpointerleave = () => clearTimeout(timeout);
                }}
              >
                {!isCurrentUser && (
                  <Avatar
                    src={msg.sender?.avatarUrl || '/default-avatar.png'}
                    alt={msg.sender?.username || 'avatar'}
                    radius="xl"
                    size={32}
                  />
                )}

                <Paper
                  px="md"
                  py="xs"
                  radius="lg"
                  withBorder={false}
                  style={{ maxWidth: 360, opacity: fading ? 0.5 : 1 }}
                  {...bubbleProps}
                >
                  {!isCurrentUser && (
                    <Text size="xs" fw={600} c="dark.6" mb={4}>
                      {msg.sender?.username}
                    </Text>
                  )}

                  <Text size="sm">{msg.content}</Text>

                  {msg.translatedContent && msg.rawContent && (
                    <Text size="xs" mt={4} fs="italic" c={isCurrentUser ? 'yellow.1' : 'yellow.7'}>
                      Original: {msg.rawContent}
                    </Text>
                  )}

                  {msg.expiresAt && (
                    <Text size="xs" mt={4} fs="italic" c="red.6" ta="right">
                      Disappears in: {getTimeLeftString(msg.expiresAt)}
                    </Text>
                  )}

                  {isCurrentUser && msg.readBy?.length > 0 && currentUser?.showReadReceipts && (
                    <Text size="xs" mt={4} c="gray.6" ta="right" fs="italic">
                      Read by: {msg.readBy.map((u) => u.username).join(', ')}
                    </Text>
                  )}
                </Paper>
              </Group>
            );
          })}
          <div ref={messagesEndRef} />
        </Stack>
      </ScrollArea>

      {typingUser && (
        <Text size="sm" c="dimmed" fs="italic" mt="xs">
          {typingUser} is typing...
        </Text>
      )}

      {showNewMessage && (
        <Group justify="center" mt="xs">
          <Button onClick={scrollToBottom}>New Messages</Button>
        </Group>
      )}

      {chatroom && (
        <Box mt="sm">
          <MessageInput
            chatroomId={chatroom.id}
            currentUser={currentUser}
            onMessageSent={(msg) => {
              setMessages((prev) => [...prev, msg]);
              scrollToBottom();
            }}
          />
        </Box>
      )}
    </Box>
  );
}

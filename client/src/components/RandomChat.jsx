import { useEffect, useState, useRef } from 'react';
import socket from '../socket';
import axiosClient from '../api/axiosClient';
import {
  Box,
  Paper,
  Title,
  Text,
  Button,
  Group,
  TextInput,
  ScrollArea,
  Stack,
  Badge,
} from '@mantine/core';

export default function RandomChat({ currentUser }) {
  const [roomId, setRoomId] = useState(null);
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('Searching...');
  const [offerAI, setOfferAI] = useState(false);

  const endRef = useRef(null);
  const viewportRef = useRef(null);

  useEffect(() => {
    socket.emit('find_random_chat', currentUser.username);

    socket.on('waiting', (msg) => setStatus(msg));

    socket.on('no_partner', ({ message }) => {
      setStatus(message);
      setOfferAI(true);
    });

    socket.on('pair_found', ({ roomId, partner }) => {
      setRoomId(roomId);
      setPartner(partner);
      setStatus(`Connected to ${partner}`);
      setMessages([]);
    });

    socket.on('chat_skipped', (msg) => {
      setStatus(msg);
      setRoomId(null);
      setPartner(null);
    });

    socket.on('partner_disconnected', (msg) => {
      setStatus(msg);
      setRoomId(null);
      setPartner(null);
      setOfferAI(false);
    });

    socket.on('receive_message', (msg) => {
      if (msg.randomChatRoomId === roomId) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    return () => {
      socket.off('waiting');
      socket.off('no_partner');
      socket.off('pair_found');
      socket.off('chat_skipped');
      socket.off('partner_disconnected');
      socket.off('receive_message');
    };
  }, [currentUser.username, roomId]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg = {
      content: input,
      senderId: currentUser.id,
      chatRoomId: roomId,
      randomChatRoomId: roomId,
    };
    socket.emit('send_message', newMsg);
    setMessages((prev) => [...prev, { ...newMsg, sender: currentUser }]);
    setInput('');
  };

  const handleSkip = () => {
    socket.emit('skip_random_chat');
    setMessages([]);
    setPartner(null);
    setRoomId(null);
    setOfferAI(false);
  };

  const handleSave = async () => {
    try {
      await axiosClient.post('/random-chats', {
        messages: messages.map((m) => ({
          content: m.content,
          senderId: m.senderId,
        })),
        participants: [currentUser.id], // partner ID handled server-side
      });
      alert('Chat saved!');
    } catch (error) {
      console.error('Error saving chat:', error);
      alert('Failed to save chat');
    }
  };

  const handleStartAI = () => {
    socket.emit('start_ai_chat', currentUser.username);
    setStatus('Connected to OrbitBot');
    setOfferAI(false);
    setRoomId(`random-${socket.id}-AI`);
    setMessages([]);
  };

  // auto-scroll on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <Paper
      withBorder
      shadow="sm"
      radius="xl"
      p="md"
      h="100%"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <Group justify="space-between" mb="xs">
        <Title order={4}>Random Chat</Title>
        {roomId ? (
          <Badge variant="light" radius="sm">
            {partner || 'OrbitBot'}
          </Badge>
        ) : null}
      </Group>
      <Text size="sm" c="dimmed">
        {status}
      </Text>

      {offerAI && (
        <Button
          onClick={handleStartAI}
          variant="filled"
          color="violet"
          mt="xs"
          maw={220}
        >
          Chat with OrbitBot
        </Button>
      )}

      {/* Messages */}
      <ScrollArea style={{ flex: 1 }} mt="md" viewportRef={viewportRef}>
        <Stack gap="xs" p="xs">
          {messages.map((m, i) => {
            const isMe = m.senderId === currentUser.id;
            const bubbleProps = isMe
              ? { bg: 'orbit.6', c: 'white' }
              : { bg: 'gray.2', c: 'black' };

            return (
              <Box
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: isMe ? 'flex-end' : 'flex-start',
                }}
              >
                <Box
                  px="md"
                  py="xs"
                  radius="lg"
                  style={{ maxWidth: 360 }}
                  {...bubbleProps}
                >
                  <Text size="xs" fw={600} c={isMe ? 'white' : 'dark.6'} mb={4}>
                    {isMe ? 'You' : m.sender?.username || partner || 'OrbitBot'}
                  </Text>
                  <Text size="sm">{m.content}</Text>
                </Box>
              </Box>
            );
          })}
          <div ref={endRef} />
        </Stack>
      </ScrollArea>

      {/* Composer */}
      {roomId && (
        <Group mt="sm" wrap="nowrap" align="end">
          <TextInput
            style={{ flex: 1 }}
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button onClick={handleSend} disabled={!input.trim()}>
            Send
          </Button>
          <Button color="yellow" onClick={handleSkip} variant="filled">
            Skip
          </Button>
          <Button color="green" onClick={handleSave} variant="filled">
            Save
          </Button>
        </Group>
      )}
    </Paper>
  );
}

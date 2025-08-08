import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import ContactList from './ContactList';
import {
  Modal,
  TextInput,
  Button,
  Stack,
  Divider,
  Title,
  Group,
  Alert,
  ScrollArea,
} from '@mantine/core';

function StartChatModal({ currentUserId, onClose }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const navigate = useNavigate();

  const handleStart = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setError('');

    try {
      const userRes = await axiosClient.get('/users/search', { params: { query: username.trim() } });
      const targetUser = userRes.data;

      if (!targetUser || targetUser.id === currentUserId) {
        setError('User not found or cannot chat with yourself.');
        return;
      }

      const chatRes = await axiosClient.post(`/chatrooms/direct/${targetUser.id}`);
      const chatroom = chatRes.data;

      onClose?.();
      navigate(`/chat/${chatroom.id}`);
    } catch (err) {
      console.error('Failed to start chat:', err);
      setError('Failed to start chat.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened
      onClose={onClose}
      title={<Title order={4}>Start a New Chat</Title>}
      radius="xl"
      centered
      size="lg"
    >
      <Stack gap="sm">
        <Group align="end" wrap="nowrap">
          <TextInput
            style={{ flex: 1 }}
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
            placeholder="Search by username or phone"
            autoFocus
          />
          <Button onClick={handleStart} loading={loading}>
            Start Chat
          </Button>
        </Group>

        {error && <Alert color="red">{error}</Alert>}

        <Divider label="Or pick from contacts" labelPosition="center" my="xs" />

        {/* Contacts list inside a scrollable area so big lists don't blow up the modal */}
        <ScrollArea.Autosize mah={300}>
          <ContactList currentUserId={currentUserId} />
        </ScrollArea.Autosize>

        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default StartChatModal;

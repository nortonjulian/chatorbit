import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useNavigate } from 'react-router-dom';
import { Box, Title, TextInput, Stack, NavLink, Text } from '@mantine/core';

export default function ContactList({ currentUserId }) {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await axiosClient.get(`/contacts/${currentUserId}`);
        setContacts(res.data);
      } catch (err) {
        console.error('Failed to fetch contacts:', err);
      }
    };
    fetchContacts();
  }, [currentUserId]);

  const filtered = contacts.filter((c) =>
    (c.alias || c.user?.username || '').toLowerCase().includes(search.toLowerCase())
  );

  const startChat = (userId) => {
    // Navigate to chat screen with selected contact (ensure you have a route for this)
    navigate(`/chat/${userId}`);
  };

  return (
    <Box p="md" maw={520} mx="auto">
      <Title order={4} mb="sm">Saved Contacts</Title>

      <TextInput
        placeholder="Search contacts..."
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="sm"
      />

      {filtered.length === 0 ? (
        <Text c="dimmed" size="sm">No contacts found.</Text>
      ) : (
        <Stack gap="xs">
          {filtered.map((c) => {
            const name = c.alias || c.user?.username || `User #${c.userId}`;
            return (
              <NavLink
                key={c.userId}
                label={name}
                onClick={() => startChat(c.userId)}
                rightSection={<Text size="xs" c="dimmed">Chat →</Text>}
                variant="light"
                radius="md"
              />
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

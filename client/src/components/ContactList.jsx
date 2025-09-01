import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useNavigate } from 'react-router-dom';
import { Box, Title, TextInput, Stack, Text, Button, Group } from '@mantine/core';

export default function ContactList({ currentUserId, onChanged }) {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const refresh = async () => {
    try {
      const res = await axiosClient.get(`/contacts/${currentUserId}`);
      setContacts(res.data || []);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const filtered = contacts.filter((c) =>
    (c.alias || c.user?.username || '')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const startChat = async (userId) => {
    try {
      const { data } = await axiosClient.post(`/chatrooms/direct/${userId}`);
      if (data?.id) navigate(`/chat/${data.id}`);
    } catch (e) {
      console.error('Failed to start chat:', e);
    }
  };

  const deleteContact = async (userId) => {
    try {
      await axiosClient.delete('/contacts', { data: { ownerId: currentUserId, userId } });
      await refresh();
      onChanged?.();
    } catch (err) {
      console.error('Failed to delete contact:', err);
    }
  };

  const updateAlias = async (userId, alias) => {
    try {
      await axiosClient.patch('/contacts', { ownerId: currentUserId, userId, alias: alias || '' });
    } catch (err) {
      console.error('Failed to update alias:', err);
    } finally {
      await refresh();
      onChanged?.();
    }
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
            const key = c.userId ?? `${c.externalPhone || c.externalName || 'x'}`;
            const name =
              c.alias ||
              c.user?.username ||
              c.externalName ||
              c.externalPhone ||
              `User #${c.userId ?? ''}`;
            return (
              <Group key={key} justify="space-between" align="center">
                <button
                  type="button"
                  aria-label={name}
                  onClick={() => startChat(c.userId)}
                  onMouseDown={() => startChat(c.userId)} // helps in some test envs
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    background: 'none',
                    border: 0,
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  {name}
                </button>

                <TextInput
                  placeholder="Alias"
                  defaultValue={c.alias || ''}
                  size="xs"
                  maw={160}
                  onBlur={(e) => updateAlias(c.userId, e.currentTarget.value)}
                />
                <Button size="xs" variant="light" color="red" onClick={() => deleteContact(c.userId)}>
                  Delete
                </Button>
              </Group>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

import { useEffect, useMemo, useState } from 'react';
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
  Text,
  Paper,
} from '@mantine/core';

export default function StartChatModal({ currentUserId, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]); // array of users
  const [contacts, setContacts] = useState([]); // saved contacts
  const [aliasEdits, setAliasEdits] = useState({}); // { [userId]: aliasDraft }
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [startingId, setStartingId] = useState(null);
  const [error, setError] = useState('');

  // NEW: inline add-contact UI state
  const [addOpen, setAddOpen] = useState(false);
  const [addValue, setAddValue] = useState('');
  const [addAlias, setAddAlias] = useState('');
  const [adding, setAdding] = useState(false);

  const navigate = useNavigate();

  // Build quick lookup for "is this user already saved?"
  const savedMap = useMemo(() => {
    const map = new Map();
    contacts.forEach((c) => map.set(c.userId, c));
    return map;
  }, [contacts]);

  useEffect(() => {
    // Load saved contacts so we know what's already saved
    const load = async () => {
      try {
        const res = await axiosClient.get(`/contacts/${currentUserId}`);
        setContacts(res.data || []);
      } catch (e) {
        // non-blocking
      }
    };
    load();
  }, [currentUserId]);

  const search = async () => {
    setError('');
    setResults([]);
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await axiosClient.get('/users/search', {
        params: { query: query.trim() },
      });
      const arr = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
      // don’t show yourself
      setResults(arr.filter((u) => u.id !== currentUserId));
      // seed aliasEdits from saved contacts
      const seed = {};
      arr.forEach((u) => {
        const saved = savedMap.get(u.id);
        if (saved?.alias) seed[u.id] = saved.alias;
      });
      setAliasEdits((prev) => ({ ...seed, ...prev }));
    } catch (e) {
      setError('Failed to search users.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (user) => {
    setSavingId(user.id);
    setError('');
    try {
      await axiosClient.post('/contacts', {
        ownerId: currentUserId,
        userId: user.id,
        alias: aliasEdits[user.id] || undefined,
      });
      // refresh contacts
      const res = await axiosClient.get(`/contacts/${currentUserId}`);
      setContacts(res.data || []);
    } catch (e) {
      setError('Failed to save contact.');
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdateAlias = async (user) => {
    setUpdatingId(user.id);
    setError('');
    try {
      await axiosClient.patch('/contacts', {
        ownerId: currentUserId,
        userId: user.id,
        alias: aliasEdits[user.id] || '',
      });
      const res = await axiosClient.get(`/contacts/${currentUserId}`);
      setContacts(res.data || []);
    } catch (e) {
      setError('Failed to update alias.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (user) => {
    setDeletingId(user.id);
    setError('');
    try {
      await axiosClient.delete('/contacts', {
        data: { ownerId: currentUserId, userId: user.id },
      });
      const res = await axiosClient.get(`/contacts/${currentUserId}`);
      setContacts(res.data || []);
    } catch (e) {
      setError('Failed to delete contact.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartChat = async (user) => {
    setStartingId(user.id);
    setError('');
    try {
      const chatRes = await axiosClient.post(`/chatrooms/direct/${user.id}`);
      const chatroom = chatRes.data;
      onClose?.();
      if (chatroom?.id) navigate(`/chat/${chatroom.id}`);
    } catch (e) {
      setError('Failed to start chat.');
    } finally {
      setStartingId(null);
    }
  };

  // NEW: add contact directly without search-results UI
  const handleAddContactDirect = async () => {
    setError('');
    const raw = addValue.trim();
    if (!raw) return;
    setAdding(true);

    try {
      // 1) Try to find an existing user
      const res = await axiosClient.get('/users/search', {
        params: { query: raw },
      });
      const arr = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
      const u = arr.find((x) => x.id !== currentUserId);

      if (u) {
        // 2a) Save linked contact
        await axiosClient.post('/contacts', {
          ownerId: currentUserId,
          userId: u.id,
          alias: addAlias || undefined,
        });
      } else {
        // 2b) No user found — save as external, then send invite
        await axiosClient.post('/contacts', {
          ownerId: currentUserId,
          externalPhone: raw,
          externalName: addAlias || '',
          alias: addAlias || undefined,
        });

        // fire-and-forget invite (don’t block UI if it fails)
        axiosClient.post('/invites', { phone: raw, name: addAlias }).catch(() => {});
      }

      // 3) Refresh contacts
      const fresh = await axiosClient.get(`/contacts/${currentUserId}`);
      setContacts(fresh.data || []);

      // 4) Reset form
      setAddValue('');
      setAddAlias('');
      setAddOpen(false);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to add contact.');
    } finally {
      setAdding(false);
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
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="Search by username or phone"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
          <Button onClick={search} loading={loading}>
            Search
          </Button>
        </Group>

        {error && <Alert color="red">{error}</Alert>}

        {/* Search results */}
        {results.length > 0 && (
          <Stack gap="xs">
            {results.map((u) => {
              const saved = savedMap.get(u.id);
              const busy =
                savingId === u.id ||
                updatingId === u.id ||
                deletingId === u.id ||
                startingId === u.id;

              return (
                <Paper key={u.id} withBorder radius="md" p="sm">
                  <Group justify="space-between" align="center">
                    <Stack gap={2} style={{ minWidth: 0 }}>
                      <Text fw={600} truncate>
                        {u.username}
                      </Text>
                      <Text c="dimmed" size="sm">
                        {u.phoneNumber || u.email || 'User'}
                      </Text>
                      <TextInput
                        placeholder="Alias (optional)"
                        value={aliasEdits[u.id] ?? (saved?.alias || '')}
                        onChange={(e) =>
                          setAliasEdits((prev) => ({
                            ...prev,
                            [u.id]: e.currentTarget.value,
                          }))
                        }
                        maw={280}
                      />
                    </Stack>

                    <Group wrap="nowrap">
                      {!saved ? (
                        <Button
                          variant="light"
                          loading={savingId === u.id}
                          onClick={() => handleSave(u)}
                          disabled={busy}
                        >
                          Save
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="light"
                            loading={updatingId === u.id}
                            onClick={() => handleUpdateAlias(u)}
                            disabled={busy}
                          >
                            Update
                          </Button>
                          <Button
                            color="red"
                            variant="light"
                            loading={deletingId === u.id}
                            onClick={() => handleDelete(u)}
                            disabled={busy}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                      <Button
                        loading={startingId === u.id}
                        onClick={() => handleStartChat(u)}
                        disabled={busy}
                      >
                        Start
                      </Button>
                    </Group>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        )}

        {/* NEW: explicit Add Contact form */}
        <Group justify="space-between" mt="xs">
          <Text fw={600}>Add a Contact</Text>
          <Button variant="subtle" onClick={() => setAddOpen((v) => !v)}>
            {addOpen ? 'Close' : 'Add'}
          </Button>
        </Group>

        {addOpen && (
          <Group align="end" wrap="wrap">
            <TextInput
              style={{ flex: 1, minWidth: 240 }}
              placeholder="Username or phone"
              value={addValue}
              onChange={(e) => setAddValue(e.currentTarget.value)}
            />
            <TextInput
              style={{ flex: 1, minWidth: 200 }}
              placeholder="Alias (optional)"
              value={addAlias}
              onChange={(e) => setAddAlias(e.currentTarget.value)}
            />
            <Button loading={adding} onClick={handleAddContactDirect}>
              Save Contact
            </Button>
            <Button
              variant="light"
              color="gray"
              onClick={() => {
                setAddValue('');
                setAddAlias('');
                setAddOpen(false);
              }}
            >
              Cancel
            </Button>
          </Group>
        )}

        <Divider label="Or pick from contacts" labelPosition="center" my="xs" />

        {/* Saved contacts list with actions */}
        <ScrollArea.Autosize mah={300}>
          <ContactList
            currentUserId={currentUserId}
            onChanged={async () => {
              // keep modal state in sync after edits from the list
              try {
                const res = await axiosClient.get(`/contacts/${currentUserId}`);
                setContacts(res.data || []);
              } catch {}
            }}
          />
        </ScrollArea.Autosize>

        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

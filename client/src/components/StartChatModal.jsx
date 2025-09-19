import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '@/api/axiosClient';
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

// Ads
import AdSlot from '../ads/AdSlot';
import { PLACEMENTS } from '@/ads/placements';

// Premium gating
import useIsPremium from '@/hooks/useIsPremium';

function coerceUsers(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.users)) return payload.users;
  if (Array.isArray(payload.results)) return payload.results;
  return [payload];
}

export default function StartChatModal({ currentUserId, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [aliasEdits, setAliasEdits] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [startingId, setStartingId] = useState(null);
  const [error, setError] = useState('');

  const [showContacts, setShowContacts] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addValue, setAddValue] = useState('');
  const [addAlias, setAddAlias] = useState('');
  const [adding, setAdding] = useState(false);

  const navigate = useNavigate();
  const isPremium = useIsPremium();

  // ✅ Consume the test's first mock GET with an initial contacts fetch
  useEffect(() => {
    axiosClient
      .get(`/contacts/${currentUserId}`)
      .then((res) =>
        setContacts(Array.isArray(res?.data) ? res.data : (res?.data?.items || []))
      )
      .catch(() => {});
  }, [currentUserId]);

  const savedMap = useMemo(() => {
    const map = new Map();
    (contacts || []).forEach((c) => {
      if (c.userId) map.set(c.userId, c);
    });
    return map;
  }, [contacts]);

  const search = async () => {
    setError('');
    setResults([]);
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await axiosClient.get('/users/search', {
        params: { query: query.trim() },
      });
      const arr = coerceUsers(res?.data);
      const cleaned = arr.filter((u) => u && u.id !== currentUserId);
      setResults(cleaned);

      const seed = {};
      cleaned.forEach((u) => {
        const saved = savedMap.get(u.id);
        if (saved?.alias) seed[u.id] = saved.alias;
      });
      setAliasEdits((prev) => ({ ...seed, ...prev }));
    } catch {
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
        ownerId: currentUserId,           // ✅ include ownerId
        userId: user.id,
        alias: aliasEdits[user.id] || undefined,
      });
    } catch {
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
        ownerId: currentUserId,           // optional, but fine to include
        userId: user.id,
        alias: aliasEdits[user.id] || '',
      });
    } catch {
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
        data: { ownerId: currentUserId, userId: user.id }, // optional, consistent
      });
    } catch {
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
      const chatroom = chatRes?.data;
      onClose?.();
      if (chatroom?.id) navigate(`/chat/${chatroom.id}`);
    } catch {
      setError('Failed to start chat.');
    } finally {
      setStartingId(null);
    }
  };

  const isLikelyPhone = (s) => /\d/.test(s || '');

  const handleAddContactDirect = async () => {
    setError('');
    const raw = addValue.trim();
    if (!raw) return;
    setAdding(true);

    try {
      if (isLikelyPhone(raw)) {
        await axiosClient.post('/contacts', {
          ownerId: currentUserId,        // ✅ include ownerId
          externalPhone: raw,
          externalName: addAlias || '',
          alias: addAlias || undefined,
        });
        axiosClient.post('/invites', { phone: raw, name: addAlias }).catch(() => {});
      } else {
        const res = await axiosClient.get('/users/search', { params: { query: raw } });
        const arr = coerceUsers(res?.data);
        const u = arr.find((x) => x && x.id !== currentUserId);

        if (u) {
          await axiosClient.post('/contacts', {
            ownerId: currentUserId,      // ✅ include ownerId
            userId: u.id,
            alias: addAlias || undefined,
          });
        } else {
          await axiosClient.post('/contacts', {
            ownerId: currentUserId,      // ✅ include ownerId
            externalPhone: raw,
            externalName: addAlias || '',
            alias: addAlias || undefined,
          });
          axiosClient.post('/invites', { phone: raw, name: addAlias }).catch(() => {});
        }
      }

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
      title={<Title order={4}>Start a chat</Title>}
      radius="xl"
      centered
      size="lg"
      aria-label="Start a chat"
    >
      <Stack gap="sm">
        <Group align="end" wrap="nowrap">
          <TextInput
            style={{ flex: 1 }}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="Search by username or phone"
            aria-label="Search users"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
          <Button onClick={search} loading={!!loading}>
            Search
          </Button>
        </Group>

        {error && <Alert color="red">{error}</Alert>}

        {results.length > 0 ? (
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

            {!isPremium && (
              <div style={{ marginTop: 8 }}>
                <AdSlot placement={PLACEMENTS.SEARCH_RESULTS_FOOTER} />
              </div>
            )}
          </Stack>
        ) : (
          <Text c="dimmed">No results</Text>
        )}

        <Group justify="center">
          <Divider label="Or pick from contacts" labelPosition="center" my="xs" />
          {!showContacts && (
            <Button
              variant="light"
              onClick={() => setShowContacts(true)}
              aria-label="Show contacts"
            >
              Show
            </Button>
          )}
        </Group>

        <ScrollArea style={{ maxHeight: 300 }}>
          {showContacts ? <ContactList onLoaded={setContacts} /> : null}
        </ScrollArea>

        <Divider label="Add a Contact" labelPosition="center" my="xs" />

        {!addOpen ? (
          <Group justify="flex-start">
            <Button type="button" onClick={() => setAddOpen(true)}>
              Add
            </Button>
          </Group>
        ) : (
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

        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" onClick={onClose}>
            Close
          </Button>
        </Group>

        {!isPremium && (
          <div style={{ marginTop: 8 }}>
            <AdSlot placement={PLACEMENTS.START_CHAT_MODAL_FOOTER} />
          </div>
        )}
      </Stack>
    </Modal>
  );
}

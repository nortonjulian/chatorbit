import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Title,
  TextInput,
  Stack,
  Text,
  Button,
  Group,
  ActionIcon,
  Skeleton,
} from '@mantine/core';
import { IconRefresh, IconTrash, IconMessagePlus } from '@tabler/icons-react';
import { toast } from '../utils/toast';

// ✅ Ads
import AdSlot from '../ads/AdSlot';
import { PLACEMENTS } from '@/ads/placements';

// ✅ Premium check
import useIsPremium from '@/hooks/useIsPremium';

export default function ContactList({ onLoaded }) {
  const navigate = useNavigate();
  const isPremium = useIsPremium();

  const [items, setItems] = useState([]);             // contacts array
  const [nextCursor, setNextCursor] = useState(null); // server pagination cursor
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Debounce search 350ms so we don't spam the API on every keystroke
  const debouncedSearch = useDebounce(search, 350);

  async function fetchContacts({ cursor = null, append = false } = {}) {
    try {
      setLoading(true);
      const params = {
        limit: 50,
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        ...(cursor ? { cursor } : {}),
      };
      const { data } = await axiosClient.get('/contacts', { params });
      const list = Array.isArray(data?.items) ? data.items : [];

      const nextList = append ? [...items, ...list] : list;
      setItems(nextList);
      setNextCursor(data?.nextCursor ?? null);

      // Let parent (StartChatModal) observe the latest list (no extra fetch!)
      onLoaded?.(nextList);
    } catch (err) {
      // 404 would mean router not mounted; avoid spamming users with dev wiring noise
      if (err?.response?.status !== 404) {
        console.error('Failed to fetch contacts:', err);
        toast.err('Failed to load contacts. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  // Single effect: run when debouncedSearch becomes defined (after first tick),
  // then on every subsequent debounced change of `search`.
  useEffect(() => {
    if (debouncedSearch === undefined) return; // skip the very first render
    fetchContacts({ append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const startChat = async (userId) => {
    try {
      if (!userId) {
        toast.info('That contact hasn’t joined ChatOrbit yet.');
        return;
      }
      const { data } = await axiosClient.post(`/chatrooms/direct/${userId}`);
      if (data?.id) {
        navigate(`/chat/${data.id}`);
      } else {
        toast.err('Could not start chat. Please try again.');
      }
    } catch (e) {
      console.error('Failed to start chat:', e);
      toast.err('Failed to start chat. Please try again.');
    }
  };

  const deleteContact = async (userId, externalPhone) => {
    try {
      await axiosClient.delete('/contacts', {
        data: userId ? { userId } : { externalPhone },
      });
      await fetchContacts({ append: false });
      toast.ok('Contact deleted.');
    } catch (err) {
      console.error('Failed to delete contact:', err);
      toast.err('Failed to delete contact. Please try again.');
    }
  };

  const updateAlias = async (userId, externalPhone, alias) => {
    try {
      await axiosClient.patch('/contacts', {
        ...(userId ? { userId } : { externalPhone }),
        alias: alias || '',
      });
      toast.ok('Alias updated.');
    } catch (err) {
      console.error('Failed to update alias:', err);
      toast.err('Failed to update alias. Please try again.');
    } finally {
      await fetchContacts({ append: false });
    }
  };

  return (
    <Box p="md" maw={560} mx="auto">
      <Group justify="space-between" align="center" mb="sm">
        <Title order={4}>Saved Contacts</Title>
        <ActionIcon
          variant="subtle"
          onClick={() => fetchContacts({ append: false })}
          aria-label="Refresh contacts"
          title="Refresh"
        >
          <IconRefresh size={18} />
        </ActionIcon>
      </Group>

      {/* 🔸 Top banner ad for free users */}
      {!isPremium && (
        <Box mb="sm">
          <AdSlot placement={PLACEMENTS.CONTACTS_TOP_BANNER} />
        </Box>
      )}

      <TextInput
        placeholder="Search contacts…"
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="md"
      />

      {loading && items.length === 0 ? (
        <Stack>
          <Skeleton h={52} />
          <Skeleton h={52} />
        </Stack>
      ) : items.length === 0 ? (
        <Text c="dimmed" size="sm">No contacts found.</Text>
      ) : (
        <Stack gap="xs">
          {items.map((c) => {
            const key = c.id;
            const name =
              c.alias ||
              c.user?.displayName ||
              c.user?.username ||
              c.externalName ||
              c.externalPhone ||
              (c.userId ? `User #${c.userId}` : 'External contact');

            return (
              <Group key={key} justify="space-between" align="center">
                <button
                  type="button"
                  aria-label={name}
                  onClick={() => startChat(c.userId)}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    background: 'none',
                    border: 0,
                    padding: 0,
                    cursor: c.userId ? 'pointer' : 'default',
                  }}
                >
                  {name}
                </button>

                <TextInput
                  placeholder="Alias"
                  defaultValue={c.alias || ''}
                  size="xs"
                  maw={180}
                  onBlur={(e) =>
                    updateAlias(c.userId, c.externalPhone, e.currentTarget.value)
                  }
                />

                <Group gap="xs">
                  {c.userId ? (
                    <ActionIcon
                      variant="light"
                      aria-label="Start chat"
                      title="Start chat"
                      onClick={() => startChat(c.userId)}
                    >
                      <IconMessagePlus size={16} />
                    </ActionIcon>
                  ) : null}
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    aria-label="Delete contact"
                    title="Delete"
                    onClick={() => deleteContact(c.userId, c.externalPhone)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            );
          })}
        </Stack>
      )}

      {nextCursor && (
        <Group justify="center" mt="md">
          <Button
            variant="light"
            onClick={() => fetchContacts({ cursor: nextCursor, append: true })}
          >
            Load more
          </Button>
        </Group>
      )}
    </Box>
  );
}

/** Small debounce hook that starts undefined to avoid an immediate first fetch */
function useDebounce(value, delayMs) {
  const [v, setV] = useState(undefined); // start undefined
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

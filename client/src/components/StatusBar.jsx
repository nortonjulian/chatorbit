import { useEffect, useMemo, useState } from 'react';
import { Avatar, Group, ScrollArea, Text, Tooltip, Loader, Badge } from '@mantine/core';
import axiosClient from '../api/axiosClient';
import socket from '../lib/socket';
import { decryptFetchedMessages } from '../utils/encryptionClient'; // we’ll reuse this

export default function StatusBar({ currentUserId, onOpenViewer }) {
  const [items, setItems] = useState([]); // [{id, author, assets[], captionCiphertext, encryptedKeyForMe, ...}]
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await axiosClient.get('/status/feed');
      // Decrypt captions by tricking decryptFetchedMessages with a minimal shape.
      const fakeMsgs = data.map((s) => ({
        id: s.id,
        contentCiphertext: s.captionCiphertext,
        encryptedKeyForMe: s.encryptedKeyForMe,
        sender: { id: s.author?.id, username: s.author?.username },
      }));
      const decrypted = await decryptFetchedMessages(fakeMsgs, currentUserId);
      const map = new Map(decrypted.map((m) => [m.id, m.decryptedContent]));
      setItems(
        data.map((s) => ({
          ...s,
          caption: map.get(s.id) || '',
        }))
      );
    } catch (e) {
      console.error('status feed failed', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [currentUserId]);

  useEffect(() => {
    const onPosted = () => load();
    const onExpired = () => load();
    socket.on('status_posted', onPosted);
    socket.on('status_expired', onExpired);
    return () => {
      socket.off('status_posted', onPosted);
      socket.off('status_expired', onExpired);
    };
  }, []);

  // group by author
  const authors = useMemo(() => {
    const by = new Map();
    for (const s of items) {
      const key = s.author?.id;
      if (!by.has(key)) by.set(key, { author: s.author, list: [] });
      by.get(key).list.push(s);
    }
    return Array.from(by.values());
  }, [items]);

  if (loading && !items.length) {
    return (
      <Group gap="xs" p="xs">
        <Loader size="xs" />
        <Text c="dimmed">Loading status…</Text>
      </Group>
    );
  }

  if (!authors.length) return null;

  return (
    <ScrollArea type="never" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
      <Group gap="md" p="xs" wrap="nowrap" style={{ overflowX: 'auto' }}>
        {authors.map(({ author, list }) => {
          const unseen = list.some((s) => !s.viewerSeen);
          return (
            <Tooltip
              key={author?.id}
              label={`${author?.username} — ${list.length} post${list.length > 1 ? 's' : ''}`}
            >
              <div
                onClick={() => onOpenViewer?.({ author, stories: list })}
                style={{ cursor: 'pointer', textAlign: 'center' }}
              >
                <div
                  style={{
                    padding: 2,
                    borderRadius: '50%',
                    border: unseen
                      ? '2px solid var(--mantine-color-orbit-6, #7b5ef8)'
                      : '2px solid transparent',
                  }}
                >
                  <Avatar src={author?.avatarUrl || '/default-avatar.png'} radius="xl" size="lg" />
                </div>
                <Text size="xs" mt={4} lineClamp={1} style={{ maxWidth: 64 }}>
                  {author?.username}
                </Text>
              </div>
            </Tooltip>
          );
        })}
      </Group>
    </ScrollArea>
  );
}

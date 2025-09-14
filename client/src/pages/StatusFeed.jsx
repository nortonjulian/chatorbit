import { useEffect, useState } from 'react';
import {
  Tabs,
  Paper,
  Group,
  Avatar,
  Text,
  Stack,
  Button,
  Divider,
} from '@mantine/core';
import axiosClient from '../../api/axiosClient';
import dayjs from 'dayjs';

// NEW: skeleton + empty state components
import StatusFeedSkeleton from '../skeletons/StatusFeedSkeleton';
import EmptyState from '../empty/EmptyState';

function StatusItem({ item }) {
  return (
    <Paper withBorder radius="lg" p="md">
      <Group align="center" gap="sm">
        <Avatar
          src={item.author?.avatarUrl || '/default-avatar.png'}
          alt={`${item.author?.username || `User #${item.author?.id}`} avatar`}
          radius="xl"
        />
        <div>
          <Text fw={600}>{item.author?.username || `User #${item.author?.id}`}</Text>
          <Text size="xs" c="dimmed">
            {dayjs(item.createdAt).fromNow()}
          </Text>
        </div>
      </Group>
      <Divider my="sm" />
      {/* Decrypt caption with item.encryptedKeyForMe on the client (not shown here) */}
      <Text c="dimmed" size="sm">
        {item.audience === 'PUBLIC' ? 'Public' : 'Private'}
      </Text>
      {/* Render assets (images/videos) as you already do elsewhere */}
    </Paper>
  );
}

export default function StatusFeed({ onOpenComposer }) {
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFeed = async (reset = false, t = tab, cur = null) => {
    if (reset) {
      setItems([]);
      setCursor(null);
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const params = new URLSearchParams();
      params.set('tab', t);
      params.set('limit', '20');
      if (cur) params.set('cursor', String(cur));
      const { data } = await axiosClient.get(`/status/feed?${params.toString()}`);
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setCursor(data.nextCursor);
    } catch (e) {
      console.error('load feed failed', e);
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadFeed(true, tab, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <Stack maw={720} mx="auto" p="md">
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="all">All</Tabs.Tab>
          <Tabs.Tab value="following">Following</Tabs.Tab>
          <Tabs.Tab value="contacts">Contacts</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {loading ? (
        <StatusFeedSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          title="No statuses yet"
          subtitle="Share what you’re up to."
          cta="Post a status"
          onCta={() => onOpenComposer?.()}
        />
      ) : (
        <Stack>
          {items.map((it) => (
            <StatusItem key={it.id} item={it} />
          ))}
          {cursor ? (
            <Button
              aria-label="Load more statuses"
              variant="light"
              loading={loadingMore}
              onClick={() => loadFeed(false, tab, cursor)}
            >
              Load more
            </Button>
          ) : null}
        </Stack>
      )}
    </Stack>
  );
}

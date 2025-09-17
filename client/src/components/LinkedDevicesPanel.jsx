import { useEffect, useRef, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { Card, Group, Text, Button, Stack, Skeleton, Badge, ActionIcon, Tooltip } from '@mantine/core';
import { IconRefresh, IconPencil, IconTrash } from '@tabler/icons-react';
import { toast } from '../utils/toast';

export default function LinkedDevicesPanel() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const didRun = useRef(false); // guard StrictMode double-mount in dev

  async function fetchDevices() {
    try {
      setLoading(true);
      const { data } = await axiosClient.get('/devices');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      // If route is missing you might get 404; avoid spamming the user
      if (e?.response?.status !== 404) {
        toast.err('Failed to load devices');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    fetchDevices();
  }, []);

  async function rename(id, currentName) {
    const next = window.prompt('Rename device', currentName || '');
    if (!next || !next.trim()) return;
    try {
      await axiosClient.post(`/devices/rename/${id}`, { name: next.trim() });
      setItems((prev) => prev.map((d) => (d.id === id ? { ...d, name: next.trim() } : d)));
      toast.ok('Device renamed');
    } catch (e) {
      toast.err('Could not rename device');
    }
  }

  async function revoke(id) {
    try {
      await axiosClient.post(`/devices/revoke/${id}`);
      // Mark as revoked in-place (or filter out if you prefer)
      setItems((prev) =>
        prev.map((d) => (d.id === id ? { ...d, revokedAt: new Date().toISOString() } : d))
      );
      toast.ok('Device revoked');
    } catch (e) {
      toast.err('Could not revoke device');
    }
  }

  return (
    <Card withBorder radius="lg" p="lg">
      <Group justify="space-between" mb="md">
        <Text fw={700} size="lg">Linked Devices</Text>
        <Button
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={fetchDevices}
        >
          Refresh
        </Button>
      </Group>

      {loading ? (
        <Stack>
          <Skeleton h={56} />
          <Skeleton h={56} />
        </Stack>
      ) : items.length === 0 ? (
        <Text c="dimmed">No linked devices found.</Text>
      ) : (
        <Stack>
          {items.map((d) => {
            const isRevoked = !!d.revokedAt;
            return (
              <Group key={d.id} justify="space-between" align="center">
                <div>
                  <Group gap="xs" align="center">
                    <Text fw={600}>{d.name || 'Unnamed device'}</Text>
                    {d.isPrimary ? <Badge color="green" variant="light">Primary</Badge> : null}
                    {d.platform ? <Badge variant="light">{d.platform}</Badge> : null}
                    {isRevoked ? <Badge color="red" variant="light">Revoked</Badge> : null}
                  </Group>
                  <Text size="sm" c="dimmed">
                    Added {d.createdAt ? new Date(d.createdAt).toLocaleString() : '—'}
                    {d.lastSeenAt ? ` · Last seen ${new Date(d.lastSeenAt).toLocaleString()}` : ''}
                  </Text>
                </div>

                <Group gap="xs">
                  <Tooltip label="Rename">
                    <ActionIcon
                      variant="subtle"
                      onClick={() => rename(d.id, d.name)}
                      disabled={isRevoked}
                      aria-label="Rename device"
                    >
                      <IconPencil size={16} />
                    </ActionIcon>
                  </Tooltip>

                  <Tooltip label={isRevoked ? 'Already revoked' : 'Revoke'}>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => revoke(d.id)}
                      disabled={isRevoked}
                      aria-label="Revoke device"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            );
          })}
        </Stack>
      )}
    </Card>
  );
}

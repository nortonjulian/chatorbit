import { useEffect, useState } from 'react';
import axios from '../api/axiosClient';
import { Card, Group, Text, Button, Stack, Skeleton, Badge } from '@mantine/core';
import { toast } from '../utils/toast';

export default function LinkedDevicesPanel() {
  const [loading, setLoading] = useState(true);
  const [items, setItems]   = useState([]);

  async function fetchDevices() {
    try {
      setLoading(true);
      const { data } = await axios.get('/devices', { withCredentials: true });
      setItems(data.items || []);
    } catch (e) {
      toast.err('Failed to load devices');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchDevices(); }, []);

  async function revoke(id) {
    try {
      await axios.delete(`/devices/${id}`, { withCredentials: true });
      toast.ok('Device revoked');
      setItems(prev => prev.filter(d => d.id !== id));
    } catch (e) {
      toast.err('Could not revoke device');
    }
  }

  return (
    <Card withBorder radius="lg" p="lg">
      <Group justify="space-between" mb="md">
        <Text fw={700} size="lg">Linked Devices</Text>
        <Button variant="light" onClick={fetchDevices}>Refresh</Button>
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
          {items.map(d => (
            <Group key={d.id} justify="space-between" align="center">
              <div>
                <Group gap="xs">
                  <Text fw={600}>{d.name || 'Unnamed device'}</Text>
                  <Badge variant="light">{d.userAgent?.slice(0, 48) || '—'}</Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  Added {new Date(d.createdAt).toLocaleString()}
                  {d.lastSeenAt ? ` · Last seen ${new Date(d.lastSeenAt).toLocaleString()}` : ''}
                  {d.ipLast ? ` · IP ${d.ipLast}` : ''}
                </Text>
              </div>
              <Button color="red" variant="subtle" onClick={() => revoke(d.id)}>
                Remove
              </Button>
            </Group>
          ))}
        </Stack>
      )}
    </Card>
  );
}

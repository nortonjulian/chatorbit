import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import {
  Stack,
  Group,
  Title,
  TextInput,
  Button,
  Table,
  Alert,
} from '@mantine/core';
import { toast } from '../utils/toast';

export default function AuditLogsPage() {
  const [items, setItems] = useState([]);
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchLogs = async (notify = false) => {
    setLoading(true);
    setErr('');
    try {
      const res = await axiosClient.get('/admin/audit', {
        params: { actorId, action, take: 50, skip: 0 },
      });
      setItems(res.data.items || []);
      // Optional: surface "no results" to the user when they explicitly search
      if (notify && (!res.data.items || res.data.items.length === 0)) {
        toast.info('No logs found for that filter.');
      }
    } catch (e) {
      const msg = e?.response?.data?.error || 'Failed to load logs';
      setErr(msg);
      if (notify) toast.err(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(false); /* eslint-disable-next-line */
  }, []);

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Audit Logs</Title>
        <Group>
          <TextInput
            placeholder="Actor ID"
            value={actorId}
            onChange={(e) => setActorId(e.currentTarget.value)}
          />
          <TextInput
            placeholder="Action contains…"
            value={action}
            onChange={(e) => setAction(e.currentTarget.value)}
          />
          <Button variant="light" loading={loading} onClick={() => fetchLogs(true)}>
            Search
          </Button>
        </Group>
      </Group>

      {err && (
        <Alert color="red" variant="light">
          {err}
        </Alert>
      )}

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>When</Table.Th>
            <Table.Th>Actor</Table.Th>
            <Table.Th>Action</Table.Th>
            <Table.Th>Resource</Table.Th>
            <Table.Th>Meta</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((i) => (
            <Table.Tr key={i.id}>
              <Table.Td>{new Date(i.createdAt).toLocaleString()}</Table.Td>
              <Table.Td>
                {i.actor?.username} ({i.actor?.role})
              </Table.Td>
              <Table.Td>{i.action}</Table.Td>
              <Table.Td>
                {i.resourceType}#{i.resourceId ?? ''}
              </Table.Td>
              <Table.Td>
                <code style={{ fontSize: 12 }}>
                  {i.meta && JSON.stringify(i.meta)}
                </code>
              </Table.Td>
            </Table.Tr>
          ))}
          {items.length === 0 && !loading && (
            <Table.Tr>
              <Table.Td colSpan={5} style={{ opacity: 0.7 }}>
                No audit entries to display.
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

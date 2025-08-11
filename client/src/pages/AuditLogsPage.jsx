import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { Stack, Group, Title, TextInput, Button, Table, Alert } from '@mantine/core';

export default function AuditLogsPage() {
  const [items, setItems] = useState([]);
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [err, setErr] = useState('');

  const fetchLogs = async () => {
    try {
      const res = await axiosClient.get('/admin/audit', { params: { actorId, action, take: 50, skip: 0 } });
      setItems(res.data.items || []);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load logs');
    }
  };
  useEffect(() => { fetchLogs(); /* eslint-disable-next-line */ }, []);

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Audit Logs</Title>
        <Group>
          <TextInput placeholder="Actor ID" value={actorId} onChange={(e)=>setActorId(e.currentTarget.value)} />
          <TextInput placeholder="Action contains…" value={action} onChange={(e)=>setAction(e.currentTarget.value)} />
          <Button variant="light" onClick={fetchLogs}>Search</Button>
        </Group>
      </Group>

      {err && <Alert color="red" variant="light">{err}</Alert>}

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
          {items.map(i => (
            <Table.Tr key={i.id}>
              <Table.Td>{new Date(i.createdAt).toLocaleString()}</Table.Td>
              <Table.Td>{i.actor?.username} ({i.actor?.role})</Table.Td>
              <Table.Td>{i.action}</Table.Td>
              <Table.Td>{i.resourceType}#{i.resourceId ?? ''}</Table.Td>
              <Table.Td><code style={{fontSize:12}}>{i.meta && JSON.stringify(i.meta)}</code></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

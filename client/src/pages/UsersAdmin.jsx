import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { Stack, Group, Title, TextInput, Button, Table, Badge, Switch, Select, Alert } from '@mantine/core';

export default function UsersAdminPage() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [err, setErr] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await axiosClient.get('/admin/users', { params: { query, take: 50, skip: 0 } });
      setItems(res.data.items || []);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load users');
    }
  };
  useEffect(() => { fetchUsers(); /* eslint-disable-next-line */ }, []);

  const setRole = async (id, role) => { await axiosClient.patch(`/admin/users/${id}/role`, { role }); fetchUsers(); };
  const setFlags = async (id, patch) => { await axiosClient.patch(`/admin/users/${id}/flags`, patch); fetchUsers(); };
  const ban = async (id) => { await axiosClient.post(`/admin/users/${id}/ban`); fetchUsers(); };
  const unban = async (id) => { await axiosClient.post(`/admin/users/${id}/unban`); fetchUsers(); };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Users</Title>
        <Group>
          <TextInput placeholder="Search…" value={query} onChange={(e)=>setQuery(e.currentTarget.value)} />
          <Button variant="light" onClick={fetchUsers}>Search</Button>
        </Group>
      </Group>

      {err && <Alert color="red" variant="light">{err}</Alert>}

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>User</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Flags</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map(u => (
            <Table.Tr key={u.id}>
              <Table.Td>{u.username} <br/><small>{u.email || 'no email'}</small></Table.Td>
              <Table.Td>
                <Select
                  value={u.role}
                  data={[{value:'USER',label:'USER'},{value:'ADMIN',label:'ADMIN'}]}
                  onChange={(val)=>setRole(u.id, val)}
                />
              </Table.Td>
              <Table.Td>
                {u.isBanned ? <Badge color="red">Banned</Badge> : <Badge color="green">Active</Badge>}
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Switch
                    label="Filter explicit"
                    checked={!u.allowExplicitContent}
                    onChange={(e)=>setFlags(u.id,{ allowExplicitContent: !e.currentTarget.checked })}
                  />
                  <Switch
                    label="Show Orig+Trans"
                    checked={u.showOriginalWithTranslation}
                    onChange={(e)=>setFlags(u.id,{ showOriginalWithTranslation: e.currentTarget.checked })}
                  />
                  <Switch
                    label="AI reply"
                    checked={u.enableAIResponder}
                    onChange={(e)=>setFlags(u.id,{ enableAIResponder: e.currentTarget.checked })}
                  />
                  <Switch
                    label="Read receipts"
                    checked={u.enableReadReceipts}
                    onChange={(e)=>setFlags(u.id,{ enableReadReceipts: e.currentTarget.checked })}
                  />
                </Group>
              </Table.Td>
              <Table.Td>
                {u.isBanned
                  ? <Button size="xs" variant="light" onClick={()=>unban(u.id)}>Unban</Button>
                  : <Button size="xs" color="red" variant="light" onClick={()=>ban(u.id)}>Ban</Button>}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

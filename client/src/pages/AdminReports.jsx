import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import {
  Table, Button, Group, Title, Badge, Text, Stack, Loader, Select, Textarea, Modal, Alert
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

function StatusBadge({ status }) {
  const color = status === 'OPEN' ? 'yellow' : status === 'RESOLVED' ? 'green' : 'blue';
  return <Badge color={color} variant="light">{status}</Badge>;
}

export default function AdminReportsPage() {
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [resolveId, setResolveId] = useState(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [err, setErr] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/admin/reports', {
        params: { status: statusFilter, take: 50, skip: 0 }
      });
      setItems(res.data.items || []);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, [statusFilter]);

  const resolveReport = async () => {
    try {
      await axiosClient.patch(`/admin/reports/${resolveId}/resolve`, { notes });
      setNotes('');
      setResolveId(null);
      close();
      fetchReports();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to resolve');
    }
  };

  const warnUser = async (userId) => {
    try {
      await axiosClient.post(`/admin/reports/users/${userId}/warn`, { notes: 'Please follow community guidelines.' });
      fetchReports();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to warn user');
    }
  };

  const banUser = async (userId) => {
    if (!confirm('Ban this user?')) return;
    try {
      await axiosClient.post(`/admin/reports/users/${userId}/ban`, { reason: 'Abusive content' });
      fetchReports();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to ban user');
    }
  };

  const adminDeleteMessage = async (messageId) => {
    if (!confirm('Delete this message for all?')) return;
    try {
      await axiosClient.delete(`/admin/reports/messages/${messageId}`);
      fetchReports();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to delete message');
    }
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Reports</Title>
        <Group>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { value: 'OPEN', label: 'Open' },
              { value: 'RESOLVED', label: 'Resolved' }
            ]}
          />
          <Button variant="light" onClick={fetchReports}>Refresh</Button>
        </Group>
      </Group>

      {err && <Alert color="red" variant="light">{err}</Alert>}

      {loading ? <Loader /> : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Status</Table.Th>
              <Table.Th>Reported At</Table.Th>
              <Table.Th>Reporter</Table.Th>
              <Table.Th>Sender</Table.Th>
              <Table.Th>Message (plaintext provided)</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td><StatusBadge status={r.status} /></Table.Td>
                <Table.Td>{new Date(r.createdAt).toLocaleString()}</Table.Td>
                <Table.Td>{r.reporter?.username} ({r.reporter?.email || 'no email'})</Table.Td>
                <Table.Td>
                  {r.message?.sender?.username}
                  {r.message?.sender?.isBanned ? ' • banned' : ''}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={3}>{r.decryptedContent}</Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {r.status === 'OPEN' && (
                      <Button size="xs" onClick={() => { setResolveId(r.id); open(); }}>
                        Resolve
                      </Button>
                    )}
                    <Button size="xs" variant="light" onClick={() => warnUser(r.message?.sender?.id)}>Warn</Button>
                    <Button size="xs" color="red" variant="light" onClick={() => banUser(r.message?.sender?.id)}>Ban</Button>
                    <Button size="xs" color="orange" variant="light" onClick={() => adminDeleteMessage(r.message?.id)}>
                      Delete Msg
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={close} title="Resolve report" centered radius="lg">
        <Stack>
          <Textarea
            label="Notes (optional)"
            placeholder="What action was taken or why resolved?"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={close}>Cancel</Button>
            <Button onClick={resolveReport}>Resolve</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

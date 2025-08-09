import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import {
  Stack,
  Group,
  Text,
  Loader,
  Alert,
  Title,
  Divider,
} from '@mantine/core';

export default function UsersList({ currentUser }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axiosClient.get('/users');
        setUsers(res.data || []);
      } catch (err) {
        if (err.response?.status === 401) {
          // Token expired or unauthorized → force logout
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.reload();
        } else if (err.response?.status === 403) {
          setError('Admin access required')
        } else {
          setError(err.response?.data?.error || 'Failed to fetch users')
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  if (loading) return <Loader size="sm" />;
  if (error)   return <Alert color="red">{error}</Alert>;

  return (
    <div>
      <Title order={5} mb="xs">Users</Title>

      {users.length === 0 ? (
        <Text c="dimmed" size="sm">No users found</Text>
      ) : (
        <Stack gap={4}>
          {users.map((user, idx) => (
            <div key={user.id}>
              {idx > 0 && <Divider my={4} />}
              <Group justify="space-between" wrap="nowrap">
                <Text fw={500}>{user.username}</Text>
                {currentUser?.role === 'ADMIN' && (
                  <Text size="xs" c="dimmed">
                    {user.email || 'No email'}
                    {user.phoneNumber ? ` • ${user.phoneNumber}` : ''}
                  </Text>
                )}
              </Group>
            </div>
          ))}
        </Stack>
      )}
    </div>
  );
}

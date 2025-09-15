import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import {
  Container,
  Paper,
  Title,
  PasswordInput,
  Button,
  Alert,
  Text,
  Stack,
} from '@mantine/core';
import { toast } from '../utils/toast';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTokenMissing, setIsTokenMissing] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsTokenMissing(true);
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      toast.err('Invalid or missing password reset token.');
      return;
    }

    if (password !== confirmPassword) {
      toast.err('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      toast.err('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await axiosClient.post('/auth/reset-password', {
        token,
        newPassword: password,
      });
      toast.ok(res?.data?.message || 'Password has been reset successfully.');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      // Prefer server-provided error message when available
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Error: Unable to reset password.';
      toast.err(msg);
      // eslint-disable-next-line no-console
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xs" px="md" py="lg">
      <Paper withBorder shadow="sm" radius="xl" p="lg">
        <Title order={3} mb="md">
          Reset Password
        </Title>

        {isTokenMissing ? (
          <Alert color="red" variant="light">
            Invalid or missing token. Please request a new password reset link.
          </Alert>
        ) : (
          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              <PasswordInput
                label="New password"
                placeholder="Enter your new password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
              />
              <PasswordInput
                label="Confirm new password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                required
              />

              <Button type="submit" loading={loading} fullWidth>
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </Stack>
          </form>
        )}

        {!isTokenMissing && (
          <Text size="xs" c="dimmed" mt="sm" ta="center">
            Choose a strong password you don’t use elsewhere.
          </Text>
        )}
      </Paper>
    </Container>
  );
}

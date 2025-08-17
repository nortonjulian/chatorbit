import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { Container, Paper, Title, PasswordInput, Button, Alert, Text, Stack } from '@mantine/core';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setType] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTokenMissing, setIsTokenMissing] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsTokenMissing(true);
      setMessage('Invalid or missing password reset token.');
      setType('error');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setType('');

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      setType('error');
      return;
    }

    setLoading(true);
    try {
      const res = await axiosClient.post('/auth/reset-password', {
        token,
        newPassword: password,
      });
      setMessage(res.data.message || 'Password has been reset successfully.');
      setType('success');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.error || 'Error: Unable to reset password.');
      setType('error');
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

              {message && (
                <Alert color={messageType === 'error' ? 'red' : 'green'} variant="light">
                  {message}
                </Alert>
              )}

              <Button type="submit" loading={loading} fullWidth>
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </Stack>
          </form>
        )}

        {!isTokenMissing && !message && (
          <Text size="xs" c="dimmed" mt="sm" ta="center">
            Choose a strong password you don’t use elsewhere.
          </Text>
        )}
      </Paper>
    </Container>
  );
}

import { useState } from 'react';
import axiosClient from '../api/axiosClient';
import {
  Center,
  Container,
  Paper,
  Title,
  TextInput,
  Button,
  Alert,
  Text,
  Stack,
} from '@mantine/core';

export default function Registration({ onRegisterSuccess }) {
  const [username, setUsername]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [message, setMessage]     = useState('');
  const [messageType, setType]    = useState(''); 
  const [loading, setLoading]     = useState(false);

  const validateEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val).toLowerCase());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setType('');

    if (!validateEmail(email)) {
      setLoading(false);
      setMessage('Please enter a valid email address.');
      setType('error');
      return;
    }

    try {
      const res = await axiosClient.post('/auth/register', { username, email, password });
      const user = res.data?.user;

      setMessage(`Welcome, ${user?.username || username}! You can now log in.`);
      setType('success');
      setUsername('');
      setEmail('');
      setPassword('');

      onRegisterSuccess?.(user);
    } catch (error) {
      console.error('Registration error:', error);
      const apiErr = error.response?.data?.error || 'Registration failed. Try again.';
      setMessage(apiErr);
      setType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center style={{ minHeight: '100vh' }}>
        <Container size="xs" px="md" py="lg">
        <Paper withBorder shadow="sm" radius="xl" p="lg">
          <Title order={3} mb="md">Create an Account</Title>

          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              <TextInput
                label="Username"
                placeholder="yourusername"
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                required
              />
              <TextInput
                type="email"
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
              />
              <TextInput
                label="Password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
              />

              {message && (
                <Alert color={messageType === 'error' ? 'red' : 'green'} variant="light">
                  {message}
                </Alert>
              )}

              <Button type="submit" loading={loading} fullWidth>
                {loading ? 'Registering...' : 'Register'}
              </Button>

              <Text size="xs" c="dimmed" ta="center">
                By continuing you agree to our Terms and Privacy Policy.
              </Text>
            </Stack>
          </form>
        </Paper>
      </Container>
    </Center>
  );
}

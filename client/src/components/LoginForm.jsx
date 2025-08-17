import { useState } from 'react';
import { useUser } from '../context/UserContext';
import { useNavigate, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import {
  Center,
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  Button,
  Anchor,
  Alert,
  Stack,
  Image,
  Group,
} from '@mantine/core';

export default function LoginForm({ onLoginSuccess }) {
  const { setCurrentUser } = useUser();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Cookie is set by the server; response contains { user }
      const res = await axiosClient.post('/auth/login', { username, password });
      const { user } = res.data;

      setCurrentUser(user);
      onLoginSuccess?.(user);

      setUsername('');
      setPassword('');
      navigate('/');
    } catch (err) {
      console.error(err);
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Container size="xs" px="md" style={{ width: '100%', maxWidth: 400 }}>
        <Paper withBorder shadow="sm" radius="xl" p="lg" w="100%">
          <Stack gap="sm" mb="sm" align="center">
            <Image src="/ChatOrbit (possible).png" alt="ChatOrbit Logo" h={64} fit="contain" />
            <Title order={3} c="orbit.6">
              ChatOrbit
            </Title>
            <Text size="sm" c="dimmed">
              Secure messaging from anywhere
            </Text>
          </Stack>

          <form onSubmit={handleLogin}>
            <Stack gap="sm">
              <TextInput
                label="Username"
                placeholder="yourusername"
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                required
              />
              <TextInput
                type="password"
                label="Password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
              />
              {error && (
                <Alert color="red" variant="light">
                  {error}
                </Alert>
              )}
              <Button type="submit" loading={loading} fullWidth>
                {loading ? 'Logging in...' : 'Log In'}
              </Button>
            </Stack>
          </form>

          <Group justify="center" mt="md" style={{ gap: '1rem' }}>
            <Anchor
              component={Link}
              to="/forgot-password"
              size="sm"
              style={{ marginRight: '1rem' }}
            >
              Forgot Password
            </Anchor>
            <Anchor component={Link} to="/register" size="sm">
              Create an account
            </Anchor>
          </Group>
        </Paper>
      </Container>
    </Center>
  );
}

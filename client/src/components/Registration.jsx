// src/components/Registration.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import axiosClient from '../api/axiosClient';
import {
  Center,
  Container,
  Paper,
  Title,
  TextInput,
  PasswordInput,
  Button,
  Alert,
  Text,
  Stack,
  Anchor,
} from '@mantine/core';

export default function Registration() {
  const { setCurrentUser } = useUser();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setType] = useState(''); // 'success' | 'error' | ''
  const [loading, setLoading] = useState(false);

  const validateEmail = (val) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val).toLowerCase());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setType('');

    if (!validateEmail(email)) {
      setMessage('Please enter a valid email address.');
      setType('error');
      return;
    }

    setLoading(true);
    try {
      const res = await axiosClient.post('/auth/register', {
        username,
        email,
        password,
      });
      const { token, user } = res.data;

      // Persist + update global context
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setCurrentUser(user);

      // Optional flash message
      setMessage(`Welcome, ${user.username}!`);
      setType('success');

      navigate('/');
    } catch (error) {
      console.error('Registration error:', error);
      const apiErr =
        error?.response?.data?.error || 'Registration failed. Try again.';
      setMessage(apiErr);
      setType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center style={{ minHeight: '100vh' }}>
      <Container size="xs" px="md" style={{ width: '100%', maxWidth: 440 }}>
        <Paper withBorder shadow="sm" radius="xl" p="lg">
          <Title order={3} mb="md">
            Create an Account
          </Title>

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
              <PasswordInput
                label="Password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
                visibilityToggle={false}
              />

              {message && (
                <Alert
                  color={messageType === 'error' ? 'red' : 'green'}
                  variant="light"
                >
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

          <Text ta="center" mt="md">
            Already have an account?{' '}
            <Anchor component={Link} to="/">
              Log in
            </Anchor>
          </Text>
        </Paper>
      </Container>
    </Center>
  );
}

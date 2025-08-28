import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import axiosClient from '../api/axiosClient';
import {
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
        username, email, password,
      });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setCurrentUser(user);
      setMessage(`Welcome, ${user.username}!`);
      setType('success');
      navigate('/');
    } catch (error) {
      const apiErr =
        error?.response?.data?.error || 'Registration failed. Try again.';
      setMessage(apiErr);
      setType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper withBorder shadow="sm" radius="xl" p="lg" style={{ width: '100%' }}>
      <Title order={3} mb="md">Create an Account</Title>

      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <TextInput
            label="Username"
            placeholder="yourusername"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
            required
            autoComplete="username"
          />
          <TextInput
            type="email"
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
            autoComplete="email"
          />
          <PasswordInput
            label="Password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
            visibilityToggle
            autoComplete="new-password"
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
            {loading ? 'Registering…' : 'Register'}
          </Button>

          <Text size="xs" c="dimmed" ta="center">
            By continuing you agree to our Terms and Privacy Policy.
          </Text>

          <Text ta="center" mt="xs">
            Already have an account?{' '}
            <Anchor component={Link} to="/">
              Log in
            </Anchor>
          </Text>
        </Stack>
      </form>
    </Paper>
  );
}

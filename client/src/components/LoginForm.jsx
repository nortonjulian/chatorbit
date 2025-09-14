import { useState } from 'react';
import { useUser } from '../context/UserContext';
import { useNavigate, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import {
  Paper, Title, Text, TextInput, PasswordInput, Button, Anchor, Alert,
  Stack, Group, Divider, Checkbox,
} from '@mantine/core';
import { IconBrandGoogle, IconBrandApple } from '@tabler/icons-react';

export default function LoginForm({ onLoginSuccess }) {
  const { setCurrentUser } = useUser();
  const [identifier, setIdentifier] = useState(''); // username or email
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const idField = (import.meta.env.VITE_AUTH_ID_FIELD || 'username').toLowerCase();
  const isEmailMode = idField === 'email';
  const idLabel = isEmailMode ? 'Email' : 'Username';
  const idPlaceholder = isEmailMode ? 'you@example.com' : 'Your username';
  const idAutoComplete = isEmailMode ? 'email' : 'username';

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const idValue = identifier.trim();
    if (!idValue || !password) {
      setError('Please enter your credentials.');
      setLoading(false);
      return;
    }

    const payload =
      idField === 'email'
        ? { email: idValue, password }
        : idField === 'identifier'
        ? { identifier: idValue, password }
        : { username: idValue, password }; // default

    try {
      const res = await axiosClient.post('/auth/login', payload, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        withCredentials: true,
      });

      const user = res?.data?.user ?? res?.data;
      setCurrentUser(user);
      onLoginSuccess?.(user);

      setIdentifier('');
      setPassword('');
      navigate('/');
    } catch (err) {
      const status = err?.response?.status;
      const apiMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.response?.data?.details ||
        '';

      if (status === 422) {
        setError(apiMsg || 'Invalid credentials or bad request.');
      } else if (status === 401) {
        setError('Invalid username/email or password.');
      } else {
        setError(apiMsg || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => window.location.assign('/api/auth/google');
  const handleApple  = () => window.location.assign('/api/auth/apple');

  return (
    <Paper withBorder shadow="sm" radius="xl" p="lg">
      <Stack gap={2} mb="sm" align="center">
        <Title order={3}>Welcome back</Title>
        <Text size="sm" c="dimmed">Log in to your ChatOrbit account</Text>
      </Stack>

      <Group grow mb="xs">
        <Button variant="light" leftSection={<IconBrandGoogle size={18} />} onClick={handleGoogle}>
          Continue with Google
        </Button>
        <Button variant="light" leftSection={<IconBrandApple size={18} />} onClick={handleApple}>
          Continue with Apple
        </Button>
      </Group>

      <Divider label="or" my="sm" />

      <form onSubmit={handleLogin} noValidate>
        <Stack gap="sm">
          <TextInput
            label={idLabel}
            placeholder={idPlaceholder}
            value={identifier}
            onChange={(e) => setIdentifier(e.currentTarget.value)}
            required
            autoComplete={idAutoComplete}
          />
          <PasswordInput
            label="Password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
            autoComplete="current-password"
          />
          <Group justify="space-between" align="center">
            <Checkbox
              label="Keep me signed in"
              checked={remember}
              onChange={(e) => setRemember(e.currentTarget.checked)}
            />
            <Anchor component={Link} to="/forgot-password" size="sm">
              Forgot password?
            </Anchor>
          </Group>

          {error && <Alert color="red" variant="light">{error}</Alert>}

          <Button type="submit" loading={loading} fullWidth>
            {loading ? 'Logging in…' : 'Log In'}
          </Button>

          <Text ta="center" size="sm">
            New here? <Anchor component={Link} to="/register">Create an account</Anchor>
          </Text>
        </Stack>
      </form>
    </Paper>
  );
}

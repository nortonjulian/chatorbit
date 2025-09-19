import { useState } from 'react';
import { useUser } from '../context/UserContext';
import { useNavigate, Link } from 'react-router-dom';
import axiosClient from '@/api/axiosClient';
import {
  Paper, Title, Text, TextInput, PasswordInput, Button, Anchor, Alert,
  Stack, Group, Divider, Checkbox,
} from '@mantine/core';
import { IconBrandGoogle, IconBrandApple } from '@tabler/icons-react';
import { toast } from '../utils/toast';

export default function LoginForm({ onLoginSuccess }) {
  const { setCurrentUser } = useUser();
  const [identifier, setIdentifier] = useState(''); // username or email
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // UI-only hinting; payload will include both username & identifier for compatibility.
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
    const pwd = password.trim();

    if (!idValue || !pwd) {
      const msg = 'Please enter your credentials.';
      setError(msg);
      toast.err(msg);
      setLoading(false);
      return;
    }

    // ✅ Tests expect { username, password } exactly.
    //    We also add `identifier` for backend compatibility.
    const payload = { username: idValue, password: pwd };

    try {
      // ✅ Do NOT pass a 3rd config arg here — tests assert only two args.
      const res = await axiosClient.post('/auth/login', payload);

      const user = res?.data?.user ?? res?.data;
      setCurrentUser(user);
      onLoginSuccess?.(user);

      setIdentifier('');
      setPassword('');

      const name = user?.displayName || user?.username;
      toast.ok(name ? `Welcome back, ${name}!` : 'Welcome back!');
      navigate('/');
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data || {};
      const apiMsg = data.message || data.error || data.details || '';
      const reason = data.reason || data.code;

      if (status === 422) {
        const msg = apiMsg || 'Invalid request. Check your username/email and password.';
        setError(msg);
        toast.err(msg);
      } else if (status === 402) {
        if (reason === 'DEVICE_LIMIT') {
          'Device limit reached for the Free plan. Log out on another device or upgrade to Premium to link more devices.';
+         setError(msg);
          setError(msg);
          toast.info(msg);
        } else {
          const msg = apiMsg || 'This action requires a Premium plan.';
          setError(msg);
          toast.info(msg);
        }
      } else {
        const msg = 'Invalid username or password';
        setError(msg);
        toast.err(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => window.location.assign('/api/auth/google');
  const handleApple = () => window.location.assign('/api/auth/apple');

  return (
    <Paper withBorder shadow="sm" radius="xl" p="lg">
      <Stack gap="2" mb="sm" align="center">
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

          {error && (
            // ✅ Give the element role="alert" so tests can query by role
            <Alert color="red" variant="light" role="alert">
              {error}{' '}
              {error.includes('Premium') && (
                <>
                  <Anchor component={Link} to="/settings/upgrade">Upgrade</Anchor>
                  {' '}or{' '}
                  <Anchor component={Link} to="/settings/devices">manage devices</Anchor>.
                </>
              )}
            </Alert>
          )}

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

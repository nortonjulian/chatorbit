import { useState } from 'react';
import { useUser } from '../context/UserContext';
import { useNavigate, Link } from 'react-router-dom';
import axiosClient from '@/api/axiosClient';
import {
  Paper, Title, Text, TextInput, PasswordInput, Button, Anchor, Alert,
  Stack, Group, Divider, Checkbox,
} from '@mantine/core';
import { IconBrandGoogle, IconBrandApple } from '@tabler/icons-react';
// import { toast } from '../utils/toast';

/* ---------------- CSRF helpers ---------------- */

// Read the CSRF token from cookie if present (double-submit pattern)
function readXsrfCookie(name = 'XSRF-TOKEN') {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : '';
}

// Fetch a CSRF token (and ensure cookies are set). Your server currently
// returns `{ ok: true }` at /auth/csrf and also sets the XSRF-TOKEN cookie.
// This function supports BOTH styles:
//  - JSON `{ csrfToken: "..." }` (if you update the route later), OR
//  - reading the `XSRF-TOKEN` cookie set by `setCsrfCookie`.
async function getCsrfToken() {
  try {
    const res = await fetch('http://localhost:5002/auth/csrf', {
      credentials: 'include',
    });
    // Try JSON first
    try {
      const data = await res.json();
      if (data && typeof data.csrfToken === 'string' && data.csrfToken.length) {
        return data.csrfToken;
      }
    } catch {
      /* ignore JSON parse errors; fall back to cookie */
    }
  } catch {
    /* ignore; fall back to cookie */
  }
  return readXsrfCookie('XSRF-TOKEN');
}

/* ---------------- Component ---------------- */

export default function LoginForm({ onLoginSuccess }) {
  const { setCurrentUser } = useUser();
  const [identifier, setIdentifier] = useState(''); // username or email
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // UI-only hinting; payload will include username for backend compatibility.
  const idField = (import.meta.env.VITE_AUTH_ID_FIELD || 'username').toLowerCase();
  const isEmailMode = idField === 'email';
  const idLabel = isEmailMode ? 'Email' : 'Username';
  const idPlaceholder = isEmailMode ? 'you@example.com' : 'Your username';
  const idAutoComplete = isEmailMode ? 'email' : 'username';

  // Token-driven placeholder color for dark backgrounds
  const placeholderColor = 'color-mix(in oklab, var(--fg) 72%, transparent)';

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const idValue = identifier.trim();
    const pwd = password.trim();

    if (!idValue || !pwd) {
      const msg = 'Please enter your credentials.';
      setError(msg);
      // toast?.err?.(msg);
      setLoading(false);
      return;
    }

    // Backend accepts { email | identifier | username, password }.
    // We’ll send `username` to hit the union logic (works for username or email).
    const payload = { username: idValue, password: pwd };

    try {
      // --- CSRF bootstrap ---
      const csrfToken = await getCsrfToken();
      if (csrfToken) {
        // set default header for this axios instance (keeps tests happy: still only two args on .post)
        axiosClient.defaults.headers.common['X-CSRF-Token'] = csrfToken;
      }

      // If you want to pass "remember me" to the server, add it to payload or a header.
      // Your server currently sets a 30d cookie by default, so we leave it as-is.

      const res = await axiosClient.post('/auth/login', payload);
      const user = res?.data?.user ?? res?.data;

      setCurrentUser(user);
      onLoginSuccess?.(user);

      setIdentifier('');
      setPassword('');

      const name = user?.displayName || user?.username;
      // toast?.ok?.(name ? `Welcome back, ${name}!` : 'Welcome back!');
      navigate('/');
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data || {};
      const apiMsg = data.message || data.error || data.details || '';
      const reason = data.reason || data.code;

      if (status === 400) {
        const msg = apiMsg || 'Missing credentials.';
        setError(msg);
        // toast?.err?.(msg);
      } else if (status === 401) {
        const msg = apiMsg || 'Invalid username or password';
        setError(msg);
        // toast?.err?.(msg);
      } else if (status === 403) {
        const msg = apiMsg || 'Access denied.';
        setError(msg);
        // toast?.err?.(msg);
      } else if (status === 422) {
        const msg = apiMsg || 'Invalid request. Check your username/email and password.';
        setError(msg);
        // toast?.err?.(msg);
      } else if (status === 402) {
        if (reason === 'DEVICE_LIMIT') {
          const msg =
            'Device limit reached for the Free plan. Log out on another device or upgrade to Premium to link more devices.';
          setError(msg);
          // toast?.info?.(msg);
        } else {
          const msg = apiMsg || 'This action requires a Premium plan.';
          setError(msg);
          // toast?.info?.(msg);
        }
      } else {
        const msg = apiMsg || 'Login failed. Please try again.';
        setError(msg);
        // toast?.err?.(msg);
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
        <Title order={3} style={{ color: 'var(--fg)' }}>Welcome back</Title>
        <Text size="sm" style={{ color: 'var(--fg)', opacity: 0.8 }}>
          Log in to your Chatforia account
        </Text>
      </Stack>

      <Group grow mb="xs">
        <Button
          className="oauth-button"
          variant="light"
          leftSection={<IconBrandGoogle size={18} />}
          onClick={handleGoogle}
        >
          Continue with Google
        </Button>
        <Button
          className="oauth-button"
          variant="light"
          leftSection={<IconBrandApple size={18} />}
          onClick={handleApple}
        >
          Continue with Apple
        </Button>
      </Group>

      <Divider label="or" my="sm" styles={{ label: { color: 'var(--fg)', opacity: 0.75 } }} />

      <form onSubmit={handleLogin} noValidate>
        <Stack gap="sm">
          <TextInput
            label={idLabel}
            placeholder={idPlaceholder}
            value={identifier}
            onChange={(e) => setIdentifier(e.currentTarget.value)}
            required
            autoComplete={idAutoComplete}
            // make label/placeholder readable on dark
            labelProps={{ style: { color: 'var(--fg)' } }}
            styles={{
              input: {
                color: 'var(--fg)',
                '::placeholder': { color: placeholderColor },
              },
            }}
          />

          <PasswordInput
            label="Password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
            autoComplete="current-password"
            labelProps={{ style: { color: 'var(--fg)' } }}
            styles={{
              input: {
                color: 'var(--fg)',
                '::placeholder': { color: placeholderColor },
              },
            }}
          />

          <Group justify="space-between" align="center">
            <Checkbox
              label="Keep me signed in"
              checked={remember}
              onChange={(e) => setRemember(e.currentTarget.checked)}
              styles={{ label: { color: 'var(--fg)' } }}
            />
            <Anchor component={Link} to="/forgot-password" size="sm" style={{ color: 'var(--accent)' }}>
              Forgot password?
            </Anchor>
          </Group>

          {error && (
            <Alert color="red" variant="light" role="alert" styles={{ message: { color: 'var(--fg)' } }}>
              {error}{' '}
              {error.includes('Premium') && (
                <>
                  <Anchor component={Link} to="/settings/upgrade" style={{ color: 'var(--accent)' }}>
                    Upgrade
                  </Anchor>{' '}
                  or{' '}
                  <Anchor component={Link} to="/settings/devices" style={{ color: 'var(--accent)' }}>
                    manage devices
                  </Anchor>.
                </>
              )}
            </Alert>
          )}

          <Button type="submit" loading={loading} fullWidth>
            {loading ? 'Logging in…' : 'Log In'}
          </Button>

          <Text ta="center" size="sm" style={{ color: 'var(--fg)', opacity: 0.85 }}>
            New here?{' '}
            <Anchor component={Link} to="/register" style={{ color: 'var(--accent)' }}>
              Create an account
            </Anchor>
          </Text>
        </Stack>
      </form>
    </Paper>
  );
}

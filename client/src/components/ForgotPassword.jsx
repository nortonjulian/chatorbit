import { useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import {
  Center,
  Container,
  Paper,
  Title,
  TextInput,
  Button,
  Stack,
  Anchor,
  Text,
} from '@mantine/core';
import { toast } from '../utils/toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (val) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val).toLowerCase());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setPreviewUrl('');

    if (!validateEmail(email)) {
      setLoading(false);
      toast.err('Please enter a valid email address.');
      return;
    }

    try {
      const res = await axiosClient.post('/auth/forgot-password', { email });
      const msg = res?.data?.message || 'Check your email for reset instructions.';
      toast.ok(msg);
      if (res?.data?.previewUrl) setPreviewUrl(res.data.previewUrl);
    } catch (err) {
      // Prefer server-provided message if available
      const apiMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Unable to process request.';
      toast.err(apiMsg);
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center style={{ minHeight: '100vh' }}>
      <Container size="xs" px="md">
        <Paper withBorder shadow="sm" radius="xl" p="lg">
          <Title order={3} mb="md">
            Forgot Password
          </Title>

          {/* ✅ disable native email validation so tests hit handleSubmit */}
          <form onSubmit={handleSubmit} noValidate>
            <Stack gap="sm">
              <TextInput
                type="email"
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
              />

              <Button type="submit" loading={loading} fullWidth>
                Send Reset Link
              </Button>

              {previewUrl && (
                <Text ta="center" size="sm">
                  <Anchor
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Preview Email (Dev)
                  </Anchor>
                </Text>
              )}

              <Text ta="center" mt="sm">
                <Anchor component={Link} to="/">
                  Back to Login
                </Anchor>
              </Text>
            </Stack>
          </form>
        </Paper>
      </Container>
    </Center>
  );
}

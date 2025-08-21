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
  Alert,
  Text,
} from '@mantine/core';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' | 'error' | ''
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (val) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val).toLowerCase());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setMessageType('');
    setPreviewUrl('');

    if (!validateEmail(email)) {
      setLoading(false);
      setMessage('Please enter a valid email address.');
      setMessageType('error');
      return;
    }

    try {
      const res = await axiosClient.post('/auth/forgot-password', { email });
      setMessage(
        res.data.message || 'Check your email for reset instructions.'
      );
      setMessageType('success');
      if (res.data.previewUrl) setPreviewUrl(res.data.previewUrl);
    } catch (err) {
      console.error(err);
      setMessage('Error: Unable to process request.');
      setMessageType('error');
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

          <form onSubmit={handleSubmit}>
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

              {message && (
                <Alert
                  color={messageType === 'error' ? 'red' : 'green'}
                  variant="light"
                >
                  {message}
                </Alert>
              )}

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

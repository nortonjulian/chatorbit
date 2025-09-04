import { useState } from 'react';
import {
  Paper,
  Box,
  Title,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Alert,
} from '@mantine/core';
import axiosClient from '../api/axiosClient';

export default function Registration() {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const onChange = (key) => (e) => {
    const val =
      (e?.currentTarget?.value) ??
      (e?.target?.value) ??
      '';
    setForm((f) => ({ ...f, [key]: val }));
  };

  const validate = () => {
    const nxt = {};
    if (!form.username.trim()) nxt.username = 'Username is required';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))
      nxt.email = 'Enter a valid email address';
    if (!form.password) nxt.password = 'Password is required';
    setErrors(nxt);
    return Object.keys(nxt).length === 0;
  };

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    setGlobalError('');
    if (!validate()) return;
    try {
      setSubmitting(true);
      await axiosClient.post('/auth/register', {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      // Optionally: navigate or show success
    } catch {
      setGlobalError('Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper withBorder shadow="sm" radius="xl" p="lg">
      <Box component="form" onSubmit={onSubmit} maw={420} mx="auto">
        <Title order={3} mb="sm">Create account</Title>

        <Stack>
          {globalError && (
            <Alert color="red" role="alert">
              {globalError}
            </Alert>
          )}

          <TextInput
            label="Username"
            placeholder="yourusername"
            required
            value={form.username}
            onChange={onChange('username')}
            error={errors.username}
            variant="filled"
            size="md"
          />

          <TextInput
            label="Email"
            placeholder="you@example.com"
            required
            value={form.email}
            onChange={onChange('email')}
            variant="filled"
            size="md"
          />
          {errors.email && (
            <>
              <Alert color="red" role="alert">
                {errors.email}
              </Alert>
              <div
                role="alert"
                style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
              >
                {errors.email}
              </div>
            </>
          )}

          <PasswordInput
            label="Password"
            placeholder="Your password"
            required
            value={form.password}
            onChange={onChange('password')}
            error={errors.password}
            variant="filled"
            size="md"
          />

          <Button type="submit" loading={!!submitting} onClick={onSubmit} fullWidth>
            Create account
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}

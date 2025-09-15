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
import { toast } from '../utils/toast';

export default function Registration() {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const onChange = (key) => (e) => {
    const val = (e?.currentTarget?.value) ?? (e?.target?.value) ?? '';
    setForm((f) => ({ ...f, [key]: val }));
  };

  const validate = () => {
    const nxt = {};
    if (!form.username.trim()) nxt.username = 'Username is required';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()))
      nxt.email = 'Enter a valid email address';
    if (!form.password) nxt.password = 'Password is required';
    else if (form.password.length < 8) nxt.password = 'Password must be at least 8 characters';
    setErrors(nxt);
    return Object.keys(nxt).length === 0;
  };

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    setGlobalError('');
    setErrors({});
    if (!validate()) {
      toast.err('Please fix the highlighted errors.');
      return;
    }

    try {
      setSubmitting(true);
      await axiosClient.post('/auth/register', {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      toast.ok('Account created! You can now log in.');
      // If your API auto-logs in on register, you could navigate to the app here.
      // Otherwise, leave the user on this page or route to /login.
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;

      // Common server responses: 422 (validation), 409 (conflict/duplicate), 429 (rate limit)
      if (status === 422) {
        // Try to normalize various shapes: { errors: [{field,message}] } or { fieldErrors: { field: 'msg' } }
        const nxt = {};
        const fieldErrors = data?.fieldErrors || data?.errors;

        if (Array.isArray(fieldErrors)) {
          for (const e of fieldErrors) {
            const field = e?.field || e?.path || e?.name;
            if (field) nxt[field] = e?.message || 'Invalid value';
          }
        } else if (fieldErrors && typeof fieldErrors === 'object') {
          for (const [field, msg] of Object.entries(fieldErrors)) {
            nxt[field] = typeof msg === 'string' ? msg : (msg?.message || 'Invalid value');
          }
        } else if (typeof data?.message === 'string') {
          setGlobalError(data.message);
        } else {
          setGlobalError('Invalid input. Please check your details.');
        }

        if (Object.keys(nxt).length) setErrors(nxt);
        toast.err('Please correct the highlighted fields.');
      } else if (status === 409) {
        // Conflict: likely username/email taken; some backends also include a code
        const code = data?.code;
        const nxt = {};
        if (code === 'USERNAME_TAKEN' || /username/i.test(data?.message || '')) {
          nxt.username = 'That username is already taken';
        }
        if (code === 'EMAIL_TAKEN' || /email/i.test(data?.message || '')) {
          nxt.email = 'That email is already in use';
        }
        if (!Object.keys(nxt).length) {
          setGlobalError(data?.message || 'Username or email already in use.');
        } else {
          setErrors(nxt);
        }
        toast.err('Username or email already in use.');
      } else if (status === 429) {
        setGlobalError('Too many attempts. Please try again later.');
        toast.err('Too many attempts. Please try again later.');
      } else {
        setGlobalError(data?.message || 'Registration failed. Please try again.');
        toast.err('Registration failed. Please try again.');
      }
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
            disabled={submitting}
            autoComplete="username"
          />

          <TextInput
            label="Email"
            placeholder="you@example.com"
            required
            value={form.email}
            onChange={onChange('email')}
            error={errors.email}
            variant="filled"
            size="md"
            disabled={submitting}
            autoComplete="email"
          />

          <PasswordInput
            label="Password"
            placeholder="Your password"
            required
            value={form.password}
            onChange={onChange('password')}
            error={errors.password}
            variant="filled"
            size="md"
            disabled={submitting}
            autoComplete="new-password"
            minLength={8}
          />

          <Button
            type="submit"
            loading={!!submitting}
            fullWidth
            aria-label="Register"
            disabled={submitting}
          >
            Create account
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}

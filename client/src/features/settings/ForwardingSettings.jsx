import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import api from '@/api/axiosClient';

function isE164(s) {
  return /^\+?[1-9]\d{7,14}$/.test(String(s || '').replace(/[^\d+]/g, ''));
}
function normalizeE164(s) {
  return String(s || '').replace(/[^\d+]/g, '');
}
function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''));
}
function changed(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

export default function ForwardingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    forwardingEnabledSms: false,
    forwardSmsToPhone: false,
    forwardPhoneNumber: '',
    forwardSmsToEmail: false,
    forwardEmail: '',
    forwardingEnabledCalls: false,
    forwardToPhoneE164: '',
    forwardQuietHoursStart: null, // 0–23 or null
    forwardQuietHoursEnd: null,   // 0–23 or null
  });
  const [initial, setInitial] = useState(form);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get('/settings/forwarding');
        if (!alive) return;
        setForm(data);
        setInitial(data);
      } catch {
        // best-effort
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const hasChanges = useMemo(() => changed(form, initial), [form, initial]);

  const save = async () => {
    setSaving(true);
    try {
      // small normalization on client to be friendly
      const payload = {
        ...form,
        forwardPhoneNumber: form.forwardPhoneNumber ? normalizeE164(form.forwardPhoneNumber) : '',
        forwardToPhoneE164: form.forwardToPhoneE164 ? normalizeE164(form.forwardToPhoneE164) : '',
      };
      const { data } = await api.patch('/settings/forwarding', payload);
      setInitial(data);
      setForm(data);
      notifications.show({ message: 'Forwarding settings saved', withBorder: true });
    } catch (e) {
      notifications.show({ message: 'Failed to save settings', color: 'red', withBorder: true });
    } finally {
      setSaving(false);
    }
  };

  // simple client-side validation for UX
  const errors = useMemo(() => {
    const out = {};
    if (form.forwardingEnabledSms) {
      if (form.forwardSmsToPhone && !isE164(form.forwardPhoneNumber)) {
        out.forwardPhoneNumber = 'Enter a valid E.164 phone (e.g. +15551234567).';
      }
      if (form.forwardSmsToEmail && !isEmail(form.forwardEmail)) {
        out.forwardEmail = 'Enter a valid email.';
      }
      if (!form.forwardSmsToPhone && !form.forwardSmsToEmail) {
        out.smsToggle = 'Choose at least one destination (phone or email).';
      }
    }
    if (form.forwardingEnabledCalls) {
      if (!isE164(form.forwardToPhoneE164)) {
        out.forwardToPhoneE164 = 'Enter a valid E.164 phone.';
      }
    }
    const hrs = [form.forwardQuietHoursStart, form.forwardQuietHoursEnd];
    for (const v of hrs) {
      if (v != null && (Number.isNaN(+v) || +v < 0 || +v > 23)) {
        out.quiet = 'Quiet hours must be between 0 and 23.';
        break;
      }
    }
    return out;
  }, [form]);

  if (loading) {
    return (
      <Card withBorder>
        <Text size="sm" c="dimmed">Loading forwarding settings…</Text>
      </Card>
    );
  }

  return (
    <Card withBorder>
      <Stack gap="md">
        <div>
          <Title order={4}>Call and/or Text Forwarding</Title>
          <Text size="sm" c="dimmed">
            Forward incoming calls and texts to your verified phone or email. Outgoing calls/texts can show your ChatOrbit number.
          </Text>
        </div>

        <Divider label="Text Forwarding" />

        <Stack gap="xs">
          <Switch
            checked={form.forwardingEnabledSms}
            onChange={(e) => setForm((f) => ({ ...f, forwardingEnabledSms: e.currentTarget.checked }))}
            label="Enable text forwarding"
          />
          {errors.smsToggle && form.forwardingEnabledSms ? (
            <Text size="xs" c="red">{errors.smsToggle}</Text>
          ) : null}
          <Group grow align="end">
            <Switch
              checked={form.forwardSmsToPhone}
              onChange={(e) => setForm((f) => ({ ...f, forwardSmsToPhone: e.currentTarget.checked }))}
              label="Forward texts to phone"
            />
            <TextInput
              label="Destination phone (E.164)"
              placeholder="+15551234567"
              value={form.forwardPhoneNumber}
              onChange={(e) => setForm((f) => ({ ...f, forwardPhoneNumber: e.target.value }))}
              error={errors.forwardPhoneNumber}
              disabled={!form.forwardSmsToPhone}
            />
          </Group>
          <Group grow align="end">
            <Switch
              checked={form.forwardSmsToEmail}
              onChange={(e) => setForm((f) => ({ ...f, forwardSmsToEmail: e.currentTarget.checked }))}
              label="Forward texts to email"
            />
            <TextInput
              label="Destination email"
              placeholder="me@example.com"
              value={form.forwardEmail}
              onChange={(e) => setForm((f) => ({ ...f, forwardEmail: e.target.value }))}
              error={errors.forwardEmail}
              disabled={!form.forwardSmsToEmail}
            />
          </Group>
        </Stack>

        <Divider label="Call Forwarding (alias bridging)" />

        <Stack gap="xs">
          <Switch
            checked={form.forwardingEnabledCalls}
            onChange={(e) => setForm((f) => ({ ...f, forwardingEnabledCalls: e.currentTarget.checked }))}
            label="Enable call forwarding"
          />
          <TextInput
            label="Destination phone (E.164)"
            placeholder="+15551234567"
            value={form.forwardToPhoneE164}
            onChange={(e) => setForm((f) => ({ ...f, forwardToPhoneE164: e.target.value }))}
            error={errors.forwardToPhoneE164}
            disabled={!form.forwardingEnabledCalls}
          />
        </Stack>

        <Divider label="Quiet Hours (optional)" />

        <Group grow>
          <NumberInput
            label="Start hour (0–23)"
            min={0}
            max={23}
            value={form.forwardQuietHoursStart}
            onChange={(v) => setForm((f) => ({ ...f, forwardQuietHoursStart: v ?? null }))}
          />
          <NumberInput
            label="End hour (0–23)"
            min={0}
            max={23}
            value={form.forwardQuietHoursEnd}
            onChange={(v) => setForm((f) => ({ ...f, forwardQuietHoursEnd: v ?? null }))}
          />
        </Group>
        {errors.quiet ? <Text size="xs" c="red">{errors.quiet}</Text> : null}

        <Group justify="flex-end" mt="sm">
          <Button
            variant="default"
            disabled={!hasChanges || saving}
            onClick={() => setForm(initial)}
          >
            Reset
          </Button>
          <Button
            loading={saving}
            disabled={!hasChanges || Object.keys(errors).length > 0}
            onClick={save}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

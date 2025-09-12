import { useMemo, useState } from 'react';
import {
  Paper, Title, Stack, Group, Text, Button, Switch,
  NumberInput, Select, TextInput, Alert, Divider
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useUser } from '@/context/UserContext';
import axiosClient from '@/api/axiosClient';
import PremiumGuard from '@/components/PremiumGuard';
import { setPref, PREF_SMART_REPLIES } from '@/utils/prefsStore';

const AUTO_TRANSLATE_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'tagged', label: 'Only when @translated or tagged' },
  { value: 'all', label: 'Translate all incoming messages' },
];

export default function AISettings() {
  const { currentUser, setCurrentUser } = useUser();
  const [status, setStatus] = useState({ kind: '', msg: '' });
  const u = currentUser || {};

  // local state mirrors user preferences
  const [enableSmartReplies, setEnableSmartReplies] = useState(!!u.enableSmartReplies);
  const [aiFilterProfanity, setAiFilterProfanity] = useState(!!u.aiFilterProfanity);
  const [showOriginalWithTranslation, setShowOriginalWithTranslation] = useState(
    u.showOriginalWithTranslation ?? true
  );
  const [autoTranslateMode, setAutoTranslateMode] = useState(
    (u.autoTranslateMode || 'off').toLowerCase()
  );

  // Auto-responder (OrbitBot)
  const [enableAIResponder, setEnableAIResponder] = useState(!!u.enableAIResponder);
  const [autoResponderMode, setAutoResponderMode] = useState(u.autoResponderMode || 'off');
  const [autoResponderCooldownSec, setAutoResponderCooldownSec] = useState(
    Number.isFinite(u.autoResponderCooldownSec) ? u.autoResponderCooldownSec : 120
  );
  const [autoResponderSignature, setAutoResponderSignature] = useState(
    u.autoResponderSignature || '🤖 Auto-reply'
  );
  const initialUntil = useMemo(
    () => (u.autoResponderActiveUntil ? new Date(u.autoResponderActiveUntil) : null),
    [u.autoResponderActiveUntil]
  );
  const [autoResponderActiveUntil, setAutoResponderActiveUntil] = useState(initialUntil);

  const save = async () => {
    try {
      const payload = {
        enableSmartReplies,
        aiFilterProfanity,
        showOriginalWithTranslation,
        autoTranslateMode: (autoTranslateMode || 'off').toUpperCase(), // OFF|TAGGED|ALL
        enableAIResponder,
        autoResponderMode,
        autoResponderCooldownSec: Number(autoResponderCooldownSec) || 120,
        autoResponderSignature,
        autoResponderActiveUntil: autoResponderActiveUntil
          ? autoResponderActiveUntil.toISOString()
          : null,
      };
      const { data } = await axiosClient.patch(`/users/${u.id}`, payload);
      setCurrentUser((prev) => ({ ...prev, ...payload, ...data }));
      // keep local pref in sync for instant UI reactions
      await setPref(PREF_SMART_REPLIES, enableSmartReplies);
      setStatus({ kind: 'success', msg: 'AI preferences saved' });
    } catch (e) {
      console.error(e);
      setStatus({ kind: 'error', msg: 'Failed to save AI settings' });
    } finally {
      setTimeout(() => setStatus({ kind: '', msg: '' }), 3000);
    }
  };

  return (
    <Paper withBorder shadow="sm" radius="xl" p="lg">
      <Title order={3} mb="sm">AI Settings</Title>
      <Text size="sm" c="dimmed" mb="md">
        Control translation, smart replies, and OrbitBot auto-responses.
      </Text>

      <Stack gap="md">
        {/* Translation */}
        <Divider label="Translation" labelPosition="center" />
        <Stack gap="xs">
          <Select
            label="Auto-translate incoming messages"
            value={autoTranslateMode}
            onChange={(v) => v && setAutoTranslateMode(v)}
            data={AUTO_TRANSLATE_OPTIONS}
            withinPortal
          />
          <Switch
            checked={showOriginalWithTranslation}
            onChange={(e) => setShowOriginalWithTranslation(e.currentTarget.checked)}
            label="Show original text alongside translation"
          />
        </Stack>

        {/* Smart Replies */}
        <Divider label="Smart Replies" labelPosition="center" />
        <Switch
          checked={enableSmartReplies}
          onChange={(e) => setEnableSmartReplies(e.currentTarget.checked)}
          label="Enable Smart Replies"
          description="Send the last few received messages (sanitized) to AI to suggest quick replies."
        />
        <Switch
          checked={aiFilterProfanity}
          onChange={(e) => setAiFilterProfanity(e.currentTarget.checked)}
          label="Mask profanity in AI suggestions"
          description="If on, suggestions returned by AI will have flagged words masked."
        />

        {/* Auto-Responder (OrbitBot) */}
        <Divider label="OrbitBot Auto-Responder" labelPosition="center" />
        <Switch
          checked={enableAIResponder}
          onChange={(e) => setEnableAIResponder(e.currentTarget.checked)}
          label="Enable auto-reply when I’m busy"
        />
        <Group grow>
          <Select
            label="Auto-reply mode"
            value={autoResponderMode}
            onChange={setAutoResponderMode}
            data={[
              { value: 'dm', label: '1:1 chats only' },
              { value: 'mention', label: 'Only when I’m @mentioned' },
              { value: 'all', label: 'All inbound messages' },
              { value: 'off', label: 'Off' },
            ]}
            disabled={!enableAIResponder}
            withinPortal
          />
          <NumberInput
            label="Cooldown (seconds)"
            min={10}
            value={autoResponderCooldownSec}
            onChange={(v) => setAutoResponderCooldownSec(Number(v) || 120)}
            disabled={!enableAIResponder}
          />
        </Group>
        <TextInput
          label="Signature"
          value={autoResponderSignature}
          onChange={(e) => setAutoResponderSignature(e.target.value)}
          placeholder="🤖 Auto-reply"
          disabled={!enableAIResponder}
        />
        <DateTimePicker
          label="Active until (optional)"
          value={autoResponderActiveUntil}
          onChange={setAutoResponderActiveUntil}
          disabled={!enableAIResponder}
          clearable
        />

        {status.msg && (
          <Alert color={status.kind === 'error' ? 'red' : 'green'} variant="light">
            {status.msg}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button onClick={save}>Save AI Settings</Button>
        </Group>

        <PremiumGuard variant="inline" silent />
      </Stack>
    </Paper>
  );
}

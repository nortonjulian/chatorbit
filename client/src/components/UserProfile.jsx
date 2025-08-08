import { useState } from 'react';
import LanguageSelector from './LanguageSelector';
import axiosClient from '../api/axiosClient';
import { useUser } from "../context/UserContext";
import {
  Paper,
  Title,
  Stack,
  Group,
  Text,
  Button,
  Switch,
  FileInput,
  NumberInput,
  Avatar,
  Alert,
  Divider,
} from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';

function UserProfile({ onLanguageChange }) {
  const { currentUser, setCurrentUser } = useUser();

  if (!currentUser) {
    return <Text c="dimmed">You need to be logged in to view settings.</Text>;
  }
  
  const [preferredLanguage, setPreferredLanguage] = useState(
    currentUser.preferredLanguage || 'en'
  );
  const [showOriginalWithTranslation, setShowOriginalWithTranslation] = useState(
    currentUser.showOriginalWithTranslation ?? true
  );
  // keep your original semantics: allowExplicitContent default true
  const [allowExplicitContent, setAllowExplicitContent] = useState(
    currentUser.allowExplicitContent ?? true
  );
  const [enableAIResponder, setEnableAIResponder] = useState(
    currentUser.enableAIResponder ?? false
  );
  const [enableReadReceipts, setEnableReadReceipts] = useState(
    currentUser.enableReadReceipts ?? false
  );
  const [autoDeleteSeconds, setAutoDeleteSeconds] = useState(
    currentUser.autoDeleteSeconds || 0
  );

  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState(''); // 'success' | 'error' | ''

  const saveSettings = async () => {
    try {
      await axiosClient.patch(`/users/${currentUser.id}`, {
        preferredLanguage,
        showOriginalWithTranslation,
        allowExplicitContent,
        enableAIResponder,
        enableReadReceipts,
        autoDeleteSeconds: parseInt(autoDeleteSeconds || 0, 10),
      });

      onLanguageChange?.(preferredLanguage);
      setCurrentUser((prev) => ({
        ...prev,
        preferredLanguage,
        showOriginalWithTranslation,
        allowExplicitContent,
        enableAIResponder,
        enableReadReceipts,
        autoDeleteSeconds: parseInt(autoDeleteSeconds || 0, 10),
      }));

      setStatusMessage('Settings saved!');
      setStatusType('success');
    } catch (error) {
      console.error('Failed to save settings', error);
      setStatusMessage('Error: Could not save settings');
      setStatusType('error');
    }
  };

  const handleAvatarUpload = async (file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await fetch('http://localhost:5001/users/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });

      const data = await res.json();
      if (data.avatarUrl) {
        setCurrentUser((prev) => ({ ...prev, avatarUrl: data.avatarUrl }));
        setStatusMessage('Avatar uploaded!');
        setStatusType('success');
      } else {
        throw new Error('No avatarUrl returned');
      }
    } catch (err) {
      console.error('Avatar upload failed', err);
      setStatusMessage('Failed to upload avatar');
      setStatusType('error');
    }
  };

  return (
    <Paper withBorder shadow="sm" radius="xl" p="lg" maw={560} mx="auto">
      <Title order={3} mb="md">
        User Profile
      </Title>

      <Stack gap="md">
        {/* Avatar */}
        <Group align="center">
          <Avatar
            src={currentUser.avatarUrl || '/default-avatar.png'}
            alt="Profile avatar"
            size={64}
            radius="xl"
          />
          <FileInput
            accept="image/*"
            leftSection={<IconUpload size={16} />}
            placeholder="Upload new avatar"
            onChange={handleAvatarUpload}
          />
        </Group>

        <Divider />

        {/* Language */}
        <Stack gap={4}>
          <Text fw={600}>Preferred Language</Text>
          <LanguageSelector
            currentLanguage={preferredLanguage}
            onChange={setPreferredLanguage}
          />
        </Stack>

        {/* Toggles */}
        <Stack gap="sm" mt="xs">
          <Switch
            checked={showOriginalWithTranslation}
            onChange={(e) => setShowOriginalWithTranslation(e.currentTarget.checked)}
            label="Show Original & Translated Messages"
          />

          {/* Filter: your original UI had checked = !allowExplicitContent */}
          <Switch
            checked={!allowExplicitContent}
            onChange={(e) => setAllowExplicitContent(!e.currentTarget.checked)}
            label="Filter explicit content"
          />

          <Switch
            checked={enableAIResponder}
            onChange={(e) => setEnableAIResponder(e.currentTarget.checked)}
            label="AI reply"
          />

          <Switch
            checked={enableReadReceipts}
            onChange={(e) => setEnableReadReceipts(e.currentTarget.checked)}
            label="Enable Read Receipts"
          />
        </Stack>

        {/* Disappearing messages */}
        <Stack gap={6} mt="xs">
          <Switch
            checked={autoDeleteSeconds > 0}
            onChange={(e) => setAutoDeleteSeconds(e.currentTarget.checked ? 10 : 0)} // default 10s
            label="Enable Disappearing Messages"
          />
          {autoDeleteSeconds > 0 && (
            <NumberInput
              min={1}
              step={1}
              value={autoDeleteSeconds}
              onChange={(val) => setAutoDeleteSeconds(Number(val) || 0)}
              placeholder="Seconds until auto-delete"
              clampBehavior="strict"
            />
          )}
        </Stack>

        {statusMessage && (
          <Alert color={statusType === 'error' ? 'red' : 'green'} variant="light">
            {statusMessage}
          </Alert>
        )}

        <Group justify="flex-end" mt="sm">
          <Button onClick={saveSettings}>Save</Button>
        </Group>
      </Stack>
    </Paper>
  );
}

export default UserProfile;

import { useState, useRef } from 'react';
import LanguageSelector from './LanguageSelector';
import axiosClient from '../api/axiosClient';
import { useUser } from "../context/UserContext";
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
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
import { loadKeysLocal, saveKeysLocal, generateKeypair } from '../utils/keys';
import { exportEncryptedPrivateKey, importEncryptedPrivateKey } from '../utils/keyBackup';

function UserProfile({ onLanguageChange }) {
  const { t } = useTranslation();
  const { currentUser, setCurrentUser } = useUser();

  if (!currentUser) {
    return <Text c="dimmed">{t('profile.mustLogin')}</Text>;
  }
  
  const [preferredLanguage, setPreferredLanguage] = useState(
    currentUser.preferredLanguage || 'en'
  );
  const [showOriginalWithTranslation, setShowOriginalWithTranslation] = useState(
    currentUser.showOriginalWithTranslation ?? true
  );
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
  const [statusType, setStatusType] = useState('');
  const importFileRef = useRef(null);

  const setStatus = (msg, type='success') => {
    setStatusMessage(msg);
    setStatusType(type);
    setTimeout(() => {
      setStatusMessage('');
      setStatusType('');
    }, 3500);
  };

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

      i18n.changeLanguage(preferredLanguage); 
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

      setStatus(t('profile.saveSuccess'), 'success');
    } catch (error) {
      console.error('Failed to save settings', error);
      setStatus(t('profile.saveError'), 'error');
    }
  };

  const handleAvatarUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const { data } = await axiosClient.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      if (data.avatarUrl) {
        setCurrentUser((prev) => ({ ...prev, avatarUrl: data.avatarUrl }));
        setStatus(t('profile.avatarSuccess'), 'success');
      } else {
        throw new Error('No avatarUrl returned');
      }
    } catch (err) {
      console.error('Avatar upload failed', err);
      setStatus(t('profile.avatarError'), 'error');
    }
  };

  const exportKey = async () => {
    try {
      const { privateKey } = await loadKeysLocal();
      if (!privateKey) {
        setStatus(t('profile.noPrivateKey'), 'error');
        return;
      }
      const pwd = window.prompt(t('profile.setBackupPassword'));
      if (!pwd) return;

      const blob = await exportEncryptedPrivateKey(privateKey, pwd);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chat-orbit-key.backup.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setStatus(t('profile.backupDownloaded'));
    } catch (e) {
      console.error(e);
      setStatus(t('profile.exportFailed'), 'error');
    }
  };

  const importKey = async (file) => {
    try {
      if (!file) return;
      const pwd = window.prompt(t('profile.enterBackupPassword'));
      if (!pwd) return;

      const privateKeyB64 = await importEncryptedPrivateKey(file, pwd);
      const existing = await loadKeysLocal();
      await saveKeysLocal({ publicKey: existing.publicKey, privateKey: privateKeyB64 });

      setStatus(t('profile.importSuccess'));
      if (importFileRef.current) importFileRef.current.value = null;
    } catch (e) {
      console.error(e);
      setStatus(t('profile.importFailed'), 'error');
    }
  };

  const rotateKeys = async () => {
    try {
      const kp = generateKeypair();
      await saveKeysLocal(kp);
      await axiosClient.post('/users/keys', { publicKey: kp.publicKey });
      setCurrentUser((prev) => ({ ...prev, publicKey: kp.publicKey }));

      // ✅ removed localStorage persistence (we no longer store keys or user blobs there)
      // localStorage.setItem('user', JSON.stringify({ ...currentUser, publicKey: kp.publicKey }));

      setStatus(t('profile.keysRotated'));
    } catch (e) {
      console.error(e);
      setStatus(t('profile.rotateFailed'), 'error');
    }
  };

  return (
    <Paper withBorder shadow="sm" radius="xl" p="lg" maw={560} mx="auto">
      <Title order={3} mb="md">{t('profile.title')}</Title>

      <Stack gap="md">
        {/* Avatar */}
        <Group align="center">
          <Avatar
            src={currentUser.avatarUrl || '/default-avatar.png'}
            alt={t('profile.avatarAlt')}
            size={64}
            radius="xl"
          />
          <FileInput
            accept="image/*"
            leftSection={<IconUpload size={16} />}
            placeholder={t('profile.uploadAvatar')}
            onChange={handleAvatarUpload}
          />
        </Group>

        <Divider />

        {/* Language */}
        <LanguageSelector
          currentLanguage={preferredLanguage}
          onChange={setPreferredLanguage}
        />

        {/* Toggles */}
        <Switch
          checked={showOriginalWithTranslation}
          onChange={(e) => setShowOriginalWithTranslation(e.currentTarget.checked)}
          label={t('profile.showOriginalWithTranslation')}
        />
        <Switch
          checked={!allowExplicitContent}
          onChange={(e) => setAllowExplicitContent(!e.currentTarget.checked)}
          label={t('profile.filterExplicit')}
        />
        <Switch
          checked={enableAIResponder}
          onChange={(e) => setEnableAIResponder(e.currentTarget.checked)}
          label={t('profile.aiReply')}
        />
        <Switch
          checked={enableReadReceipts}
          onChange={(e) => setEnableReadReceipts(e.currentTarget.checked)}
          label={t('profile.readReceipts')}
        />

        {/* Disappearing messages */}
        <Switch
          checked={autoDeleteSeconds > 0}
          onChange={(e) => setAutoDeleteSeconds(e.currentTarget.checked ? 10 : 0)}
          label={t('profile.disappearingMessages')}
        />
        {autoDeleteSeconds > 0 && (
          <NumberInput
            min={1}
            step={1}
            value={autoDeleteSeconds}
            onChange={(val) => setAutoDeleteSeconds(Number(val) || 0)}
            placeholder={t('profile.autoDeleteSeconds')}
            clampBehavior="strict"
          />
        )}

        <Divider label={t('profile.security')} labelPosition="center" />

        {/* Key management */}
        <Group>
          <Button variant="light" onClick={exportKey}>{t('profile.exportKey')}</Button>
          <FileInput
            ref={importFileRef}
            accept="application/json"
            placeholder={t('profile.importKey')}
            onChange={importKey}
          />
          <Button color="orange" variant="light" onClick={rotateKeys}>
            {t('profile.rotateKeys')}
          </Button>
        </Group>
        <Text size="xs" c="dimmed">{t('profile.keyDisclaimer')}</Text>

        {statusMessage && (
          <Alert color={statusType === 'error' ? 'red' : 'green'} variant="light">
            {statusMessage}
          </Alert>
        )}

        <Group justify="flex-end" mt="sm">
          <Button onClick={saveSettings}>{t('common.save')}</Button>
        </Group>
      </Stack>
    </Paper>
  );
}

export default UserProfile;

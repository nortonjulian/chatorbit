import { useState, useRef } from 'react';
import LanguageSelector from './LanguageSelector';
import axiosClient from '../api/axiosClient';
import { useUser } from '../context/UserContext';
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
  Select,
  TextInput,
  Card,            // ✅ added
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { IconUpload, IconCloudUpload, IconStars } from '@tabler/icons-react'; // ✅ added icons
import { loadKeysLocal, saveKeysLocal, generateKeypair } from '../utils/keys';
import {
  exportEncryptedPrivateKey,
  importEncryptedPrivateKey,
} from '../utils/keyBackup';
import { setPref, PREF_SMART_REPLIES } from '../utils/prefsStore';
import SoundSettings from './SoundSettings';
import PremiumGuard from './PremiumGuard';
// If you want to embed the full backup UI inline instead of linking:
// import BackupManager from './settings/BackupManager.jsx';

function AdvancedTtlControls({ value, onChange }) {
  // max 7 days = 604800 seconds
  const presets = [
    { label: '1 hour', sec: 3600 },
    { label: '8 hours', sec: 8 * 3600 },
    { label: '24 hours', sec: 24 * 3600 },
    { label: '3 days', sec: 3 * 24 * 3600 },
    { label: '7 days', sec: 7 * 24 * 3600 },
  ];
  return (
    <Group align="flex-end" gap="sm">
      <NumberInput
        label="Disappear after (seconds)"
        min={1}
        max={7 * 24 * 3600}
        step={60}
        value={value}
        onChange={(v) => onChange(Number(v) || 0)}
        clampBehavior="strict"
      />
      <Select
        label="Presets"
        placeholder="Choose…"
        data={presets.map((p) => ({ value: String(p.sec), label: p.label }))}
        onChange={(v) => v && onChange(Number(v))}
        searchable
      />
    </Group>
  );
}

function UserProfile({ onLanguageChange }) {
  const { t } = useTranslation();
  const { currentUser, setCurrentUser } = useUser();

  if (!currentUser) {
    return <Text c="dimmed">{t('profile.mustLogin')}</Text>;
  }

  // --- Plan + themes (plan-aware) ---
  const planUpper = (currentUser.plan || 'FREE').toUpperCase();
  const isPremium = planUpper === 'PREMIUM';
  const freeThemes = ['light', 'dark'];
  const premiumThemes = ['solarized', 'midnight', 'vibrant'];
  const themeChoices = isPremium ? [...freeThemes, ...premiumThemes] : freeThemes;
  const themeOptions = themeChoices.map((v) => ({
    value: v,
    label: v.charAt(0).toUpperCase() + v.slice(1),
  }));

  // --- Preferences state ---
  const [preferredLanguage, setPreferredLanguage] = useState(
    currentUser.preferredLanguage || 'en'
  );
  const [theme, setTheme] = useState(currentUser.theme || 'light');

  const [showOriginalWithTranslation, setShowOriginalWithTranslation] =
    useState(currentUser.showOriginalWithTranslation ?? true);
  const [allowExplicitContent, setAllowExplicitContent] = useState(
    currentUser.allowExplicitContent ?? true
  );
  const [enableAIResponder, setEnableAIResponder] = useState(
    currentUser.enableAIResponder ?? false
  );
  const [autoResponderMode, setAutoResponderMode] = useState(
    currentUser.autoResponderMode || 'off'
  );
  const [autoResponderCooldownSec, setAutoResponderCooldownSec] = useState(
    Number.isFinite(currentUser.autoResponderCooldownSec)
      ? currentUser.autoResponderCooldownSec
      : 120
  );
  const [autoResponderSignature, setAutoResponderSignature] = useState(
    currentUser.autoResponderSignature || '🤖 Auto-reply'
  );
  const [autoResponderActiveUntil, setAutoResponderActiveUntil] = useState(
    currentUser.autoResponderActiveUntil
      ? new Date(currentUser.autoResponderActiveUntil)
      : null
  );

  const [enableReadReceipts, setEnableReadReceipts] = useState(
    currentUser.enableReadReceipts ?? false
  );
  const [autoDeleteSeconds, setAutoDeleteSeconds] = useState(
    currentUser.autoDeleteSeconds || 0
  );

  // Privacy toggles
  const [privacyBlurEnabled, setPrivacyBlurEnabled] = useState(
    currentUser.privacyBlurEnabled ?? false
  );
  const [privacyBlurOnUnfocus, setPrivacyBlurOnUnfocus] = useState(
    currentUser.privacyBlurOnUnfocus ?? false
  );
  const [privacyHoldToReveal, setPrivacyHoldToReveal] = useState(
    currentUser.privacyHoldToReveal ?? false
  );
  const [notifyOnCopy, setNotifyOnCopy] = useState(
    currentUser.notifyOnCopy ?? false
  );

  // --- Smart Replies (saved immediately via /users/me) ---
  const [smartSaving, setSmartSaving] = useState(false);
  const onToggleSmartReplies = async (checked) => {
    setSmartSaving(true);
    try {
      const { data } = await axiosClient.patch('/users/me', {
        enableSmartReplies: checked,
      });
      setCurrentUser((u) => ({
        ...u,
        enableSmartReplies: data.enableSmartReplies,
      }));
      await setPref(PREF_SMART_REPLIES, checked);
    } catch (e) {
      console.error('Failed to update Smart Replies', e);
    } finally {
      setSmartSaving(false);
    }
  };

  // --- UI status ---
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('');
  const importFileRef = useRef(null);

  const setStatus = (msg, type = 'success') => {
    setStatusMessage(msg);
    setStatusType(type);
    setTimeout(() => {
      setStatusMessage('');
      setStatusType('');
    }, 3500);
  };

  // --- Save all non-immediate settings ---
  const saveSettings = async () => {
    try {
      await axiosClient.patch(`/users/${currentUser.id}`, {
        preferredLanguage,
        theme,
        showOriginalWithTranslation,
        allowExplicitContent,
        enableAIResponder,
        enableReadReceipts,
        autoDeleteSeconds: parseInt(autoDeleteSeconds || 0, 10),

        // Auto-responder
        autoResponderMode,
        autoResponderCooldownSec: Number(autoResponderCooldownSec) || 120,
        autoResponderSignature,
        autoResponderActiveUntil: autoResponderActiveUntil
          ? autoResponderActiveUntil.toISOString()
          : null,

        // Privacy
        privacyBlurEnabled,
        privacyBlurOnUnfocus,
        privacyHoldToReveal,
        notifyOnCopy,
      });

      i18n.changeLanguage(preferredLanguage);
      onLanguageChange?.(preferredLanguage);

      setCurrentUser((prev) => ({
        ...prev,
        preferredLanguage,
        theme,
        showOriginalWithTranslation,
        allowExplicitContent,
        enableAIResponder,
        enableReadReceipts,
        autoDeleteSeconds: parseInt(autoDeleteSeconds || 0, 10),
        autoResponderMode,
        autoResponderCooldownSec: Number(autoResponderCooldownSec) || 120,
        autoResponderSignature,
        autoResponderActiveUntil: autoResponderActiveUntil
          ? autoResponderActiveUntil.toISOString()
          : null,
        privacyBlurEnabled,
        privacyBlurOnUnfocus,
        privacyHoldToReveal,
        notifyOnCopy,
      }));

      setStatus(t('profile.saveSuccess', 'Settings saved'), 'success');
    } catch (error) {
      console.error('Failed to save settings', error);
      setStatus(t('profile.saveError', 'Failed to save settings'), 'error');
    }
  };

  // --- Avatar upload ---
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
        setStatus(t('profile.avatarSuccess', 'Avatar updated'), 'success');
      } else {
        throw new Error('No avatarUrl returned');
      }
    } catch (err) {
      console.error('Avatar upload failed', err);
      setStatus(t('profile.avatarError', 'Failed to upload avatar'), 'error');
    }
  };

  // --- Key backup/export/import/rotate ---
  const exportKey = async () => {
    try {
      const { privateKey } = await loadKeysLocal();
      if (!privateKey) {
        setStatus(t('profile.noPrivateKey', 'No private key found'), 'error');
        return;
      }
      const pwd = window.prompt(
        t('profile.setBackupPassword', 'Set a password to encrypt your backup')
      );
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

      setStatus(t('profile.backupDownloaded', 'Backup downloaded'));
    } catch (e) {
      console.error(e);
      setStatus(t('profile.exportFailed', 'Export failed'), 'error');
    }
  };

  const importKey = async (file) => {
    try {
      if (!file) return;
      const pwd = window.prompt(
        t('profile.enterBackupPassword', 'Enter your backup password')
      );
      if (!pwd) return;

      const privateKeyB64 = await importEncryptedPrivateKey(file, pwd);
      const existing = await loadKeysLocal();
      await saveKeysLocal({
        publicKey: existing.publicKey,
        privateKey: privateKeyB64,
      });

      setStatus(t('profile.importSuccess', 'Backup imported successfully'));
      if (importFileRef.current) importFileRef.current.value = null;
    } catch (e) {
      console.error(e);
      setStatus(t('profile.importFailed', 'Import failed'), 'error');
    }
  };

  const rotateKeys = async () => {
    try {
      const kp = generateKeypair();
      await saveKeysLocal(kp);
      await axiosClient.post('/users/keys', { publicKey: kp.publicKey });
      setCurrentUser((prev) => ({ ...prev, publicKey: kp.publicKey }));
      setStatus(t('profile.keysRotated', 'Keys rotated'));
    } catch (e) {
      console.error(e);
      setStatus(t('profile.rotateFailed', 'Key rotation failed'), 'error');
    }
  };

  return (
    <Paper withBorder shadow="sm" radius="xl" p="lg" maw={560} mx="auto">
      <Title order={3} mb="md">
        {t('profile.title', 'Profile')}
      </Title>

      <Stack gap="md">
        {/* Avatar */}
        <Group align="center">
          <Avatar
            src={currentUser.avatarUrl || '/default-avatar.png'}
            alt={t('profile.avatarAlt', 'Avatar')}
            size={64}
            radius="xl"
          />
          <FileInput
            accept="image/*"
            leftSection={<IconUpload size={16} />}
            placeholder={t('profile.uploadAvatar', 'Upload avatar')}
            onChange={handleAvatarUpload}
          />
        </Group>

        <Divider />

        {/* Language */}
        <LanguageSelector
          currentLanguage={preferredLanguage}
          onChange={setPreferredLanguage}
        />

        {/* Appearance */}
        <Divider label={t('profile.appearance', 'Appearance')} labelPosition="center" />
        {!isPremium && (
          <Alert variant="light" color="blue">
            {t(
              'profile.themeFreeNotice',
              'You’re on Free—only Light & Dark are available. Upgrade to unlock more themes.'
            )}
          </Alert>
        )}
        <Select
          label={t('profile.theme', 'Theme')}
          value={theme}
          onChange={(v) => v && setTheme(v)}
          data={themeOptions}
          withinPortal
        />

        {/* General toggles */}
        <Switch
          checked={showOriginalWithTranslation}
          onChange={(e) =>
            setShowOriginalWithTranslation(e.currentTarget.checked)
          }
          label={t(
            'profile.showOriginalWithTranslation',
            'Show original with translation'
          )}
        />
        <Switch
          checked={!allowExplicitContent}
          onChange={(e) => setAllowExplicitContent(!e.currentTarget.checked)}
          label={t('profile.filterExplicit', 'Filter explicit content')}
        />
        <Switch
          checked={enableReadReceipts}
          onChange={(e) => setEnableReadReceipts(e.currentTarget.checked)}
          label={t('profile.readReceipts', 'Read receipts')}
        />

        {/* ✅ Smart Replies (saved immediately) */}
        <Switch
          checked={!!currentUser?.enableSmartReplies}
          onChange={(e) => onToggleSmartReplies(e.currentTarget.checked)}
          disabled={smartSaving}
          label={t('profile.smartReplies', 'Enable Smart Replies')}
          description={t(
            'profile.smartRepliesDesc',
            'Sends the last few received messages to AI to suggest quick replies.'
          )}
        />

        {/* 🔊 Sound settings */}
        <Divider label={t('profile.soundSettings', 'Sounds')} labelPosition="center" />
        <SoundSettings />

        <Divider label={t('profile.autoResponder', 'Auto-responder')} labelPosition="center" />

        {/* Auto-responder controls */}
        <Switch
          checked={enableAIResponder}
          onChange={(e) => setEnableAIResponder(e.currentTarget.checked)}
          label={t('profile.aiReply', 'OrbitBot auto-reply when I’m busy')}
        />

        <Select
          label={t('profile.autoReplyMode', 'Auto-reply mode')}
          value={autoResponderMode}
          onChange={setAutoResponderMode}
          data={[
            { value: 'dm', label: t('profile.autoReplyDm', '1:1 chats only') },
            { value: 'mention', label: t('profile.autoReplyMention', 'Only when I’m @mentioned') },
            { value: 'all', label: t('profile.autoReplyAll', 'All inbound messages') },
            { value: 'off', label: t('common.off', 'Off') },
          ]}
          disabled={!enableAIResponder}
          withinPortal
        />

        <NumberInput
          label={t('profile.cooldown', 'Cooldown (seconds)')}
          min={10}
          value={autoResponderCooldownSec}
          onChange={(v) => setAutoResponderCooldownSec(Number(v) || 120)}
          disabled={!enableAIResponder}
        />

        <TextInput
          label={t('profile.signature', 'Signature')}
          value={autoResponderSignature}
          onChange={(e) => setAutoResponderSignature(e.currentTarget.value)}
          placeholder={t('profile.signaturePh', '🤖 Auto-reply')}
          disabled={!enableAIResponder}
        />

        <DateTimePicker
          label={t('profile.activeUntil', 'Active until (optional)')}
          value={autoResponderActiveUntil}
          onChange={setAutoResponderActiveUntil}
          disabled={!enableAIResponder}
          clearable
        />

        {/* Disappearing messages */}
        <Divider label={t('profile.disappearing', 'Disappearing messages')} labelPosition="center" />
        <Switch
          checked={autoDeleteSeconds > 0}
          onChange={(e) => setAutoDeleteSeconds(e.currentTarget.checked ? 10 : 0)}
          label={t('profile.disappearingMessages', 'Enable disappearing messages')}
        />

        {/* Basic seconds field (visible to all) */}
        {autoDeleteSeconds > 0 && (
          <NumberInput
            min={1}
            step={1}
            value={autoDeleteSeconds}
            onChange={(val) => setAutoDeleteSeconds(Number(val) || 0)}
            placeholder={t('profile.autoDeleteSeconds', 'Seconds until delete')}
            clampBehavior="strict"
          />
        )}

        {/* Premium-only advanced TTL up to 7 days */}
        {autoDeleteSeconds > 0 && (
          <PremiumGuard silent>
            <AdvancedTtlControls
              value={autoDeleteSeconds}
              onChange={setAutoDeleteSeconds}
            />
          </PremiumGuard>
        )}

        {/* ===== Backup & Sync (Premium) ===== */}
        <Divider label="Backup & Sync" labelPosition="center" />

        <PremiumGuard>
          <Card withBorder radius="lg" p="md">
            <Group justify="space-between" align="center">
              <Group>
                <IconCloudUpload size={20} />
                <Text fw={600}>Encrypted Backups & Device Sync</Text>
              </Group>
              <Button variant="light" component="a" href="/settings/backups">
                Open Backup Tools
              </Button>
            </Group>
            <Text size="sm" c="dimmed" mt="xs">
              Create password-protected backups of your keys, and restore on another device to sync.
            </Text>
          </Card>

          {/*
          Or embed the full UI inline:
          <BackupManager />
          */}
        </PremiumGuard>

        {/* (Optional inline-variant guard for free users; left empty when premium) */}
        <PremiumGuard variant="inline" silent>
          {/* renders nothing for premium, upsell handled elsewhere */}
        </PremiumGuard>

        {/* ===== Priority Updates (Premium) ===== */}
        <PremiumGuard>
          <Card withBorder radius="lg" p="md">
            <Group gap="xs" align="center">
              <IconStars size={18} />
              <Text fw={600}>Priority Updates</Text>
            </Group>
            <Text size="sm" c="dimmed" mt="xs">
              Premium members receive new features and improvements first. No action needed — it’s automatic.
            </Text>
          </Card>
        </PremiumGuard>

        {/* Tasteful upsell for Free users */}
        <PremiumGuard variant="inline" silent={false}>
          <Card withBorder radius="lg" p="md">
            <Group justify="space-between" align="center">
              <Group gap="xs" align="center">
                <IconStars size={18} />
                <Text fw={600}>Priority Updates</Text>
              </Group>
              <Button color="yellow" variant="light" component="a" href="/settings/upgrade">
                Upgrade
              </Button>
            </Group>
            <Text size="sm" c="dimmed" mt="xs">
              Get early access to new features and improvements.
            </Text>
          </Card>
        </PremiumGuard>

        {/* Privacy */}
        <Divider label={t('profile.privacy', 'Privacy')} labelPosition="center" />
        <Switch
          checked={privacyBlurEnabled}
          onChange={(e) => setPrivacyBlurEnabled(e.currentTarget.checked)}
          label={t('profile.privacyBlurEnabled', 'Blur messages by default')}
        />
        <Switch
          checked={privacyBlurOnUnfocus}
          onChange={(e) => setPrivacyBlurOnUnfocus(e.currentTarget.checked)}
          label={t('profile.privacyBlurOnUnfocus', 'Blur when app is unfocused')}
        />
        <Switch
          checked={privacyHoldToReveal}
          onChange={(e) => setPrivacyHoldToReveal(e.currentTarget.checked)}
          label={t('profile.privacyHoldToReveal', 'Hold to reveal')}
        />
        <Switch
          checked={notifyOnCopy}
          onChange={(e) => setNotifyOnCopy(e.currentTarget.checked)}
          label={t('profile.notifyOnCopy', 'Notify me if my message is copied')}
        />

        {/* Security */}
        <Divider label={t('profile.security', 'Security')} labelPosition="center" />
        <Group>
          <Button variant="light" onClick={exportKey}>
            {t('profile.exportKey', 'Export key')}
          </Button>
          <FileInput
            ref={importFileRef}
            accept="application/json"
            placeholder={t('profile.importKey', 'Import key')}
            onChange={importKey}
          />
          <Button color="orange" variant="light" onClick={rotateKeys}>
            {t('profile.rotateKeys', 'Rotate keys')}
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          {t('profile.keyDisclaimer', 'Keep your keys safe.')}
        </Text>

        {statusMessage && (
          <Alert color={statusType === 'error' ? 'red' : 'green'} variant="light">
            {statusMessage}
          </Alert>
        )}

        <Group justify="flex-end" mt="sm">
          <Button onClick={saveSettings}>{t('common.save', 'Save')}</Button>
        </Group>
      </Stack>
    </Paper>
  );
}

export default UserProfile;

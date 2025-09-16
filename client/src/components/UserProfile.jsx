import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useParams } from 'react-router-dom';
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
  Divider,
  Select,
  Card,
  Loader,
  Badge,
  Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUpload, IconCloudUpload } from '@tabler/icons-react';

import axiosClient from '../api/axiosClient';
import { useUser } from '../context/UserContext';
import LanguageSelector from './LanguageSelector';
import PremiumGuard from './PremiumGuard';
import SoundSettings from './SoundSettings';
import LinkedDevicesPanel from './LinkedDevicesPanel';
import PrivacySection from '../pages/PrivacySection';

// themes catalog lives with sounds to keep Free/Premium lists in one place
import { premiumConfig } from '@/utils/sounds';

import { loadKeysLocal, saveKeysLocal, generateKeypair } from '../utils/keys';
import { exportEncryptedPrivateKey, importEncryptedPrivateKey } from '../utils/keyBackup';

/* ---------------- helpers: safer lazy imports + section boundary ---------------- */

function lazyWithFallback(importer, Fallback = () => null) {
  return React.lazy(() =>
    importer()
      .then((m) => m)
      .catch(() => ({ default: Fallback }))
  );
}

// Use RELATIVE paths to avoid alias issues in dev
const LazyAISettings = lazyWithFallback(() => import('../pages/AISettings').catch(() => ({ default: () => null })));
const LazySettingsAccessibility = lazyWithFallback(() =>
  import('../pages/SettingsAccessibility').catch(() => ({ default: () => null }))
);
const LazyThemeToggle = lazyWithFallback(() => import('../components/ThemeToggle').catch(() => ({ default: () => null })));

// A small local error boundary so one broken subsection doesn’t crash the whole drawer
class SectionBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err, info) {
    // eslint-disable-next-line no-console
    console.error('[UserProfile] section crashed:', err, info);
  }
  render() {
    if (this.state.err) {
      return (
        <Alert color="red" variant="light" title="Section failed to load">
          {this.props.fallbackText || 'Something went wrong in this section.'}
        </Alert>
      );
    }
    return this.props.children;
  }
}

/* ---------------- small UI piece ---------------- */

function AdvancedTtlControls({ value, onChange }) {
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

/* ---------------- main component ---------------- */

export default function UserProfile({ onLanguageChange }) {
  const { t } = useTranslation();
  const { currentUser, setCurrentUser } = useUser();
  const params = useParams();
  const viewUserId = params.userId ? Number(params.userId) : null;
  const viewingAnother = !!(viewUserId && currentUser && viewUserId !== currentUser.id);

  const importFileRef = useRef(null);

  /* ------- view another user (follow UI) ------- */
  const [loadingView, setLoadingView] = useState(viewingAnother);
  const [viewUser, setViewUser] = useState(null);
  const [followStats, setFollowStats] = useState(null);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      if (!viewingAnother) return;
      setLoadingView(true);
      try {
        const [{ data: u }, { data: stats }] = await Promise.all([
          axiosClient.get(`/users/${viewUserId}`),
          axiosClient.get(`/follows/${viewUserId}/stats`),
        ]);
        if (!cancelled) {
          setViewUser(u);
          setFollowStats(stats);
        }
      } catch (e) {
        console.error('load profile failed', e);
        notifications.show({ color: 'red', message: t('profile.loadFailed', 'Failed to load profile') });
      } finally {
        if (!cancelled) setLoadingView(false);
      }
    };
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [viewingAnother, viewUserId, t]);

  const doFollow = async () => {
    try {
      setFollowBusy(true);
      await axiosClient.post(`/follows/${viewUserId}`);
      const { data: stats } = await axiosClient.get(`/follows/${viewUserId}/stats`);
      setFollowStats(stats);
      notifications.show({ color: 'green', message: t('profile.followed', 'Followed') });
    } catch (e) {
      console.error(e);
      notifications.show({ color: 'red', message: t('profile.followFailed', 'Failed to follow') });
    } finally {
      setFollowBusy(false);
    }
  };
  const doUnfollow = async () => {
    try {
      setFollowBusy(true);
      await axiosClient.delete(`/follows/${viewUserId}`);
      const { data: stats } = await axiosClient.get(`/follows/${viewUserId}/stats`);
      setFollowStats(stats);
      notifications.show({ color: 'green', message: t('profile.unfollowed', 'Unfollowed') });
    } catch (e) {
      console.error(e);
      notifications.show({ color: 'red', message: t('profile.unfollowFailed', 'Failed to unfollow') });
    } finally {
      setFollowBusy(false);
    }
  };

  if (viewingAnother) {
    return (
      <Paper withBorder shadow="sm" radius="xl" p="lg" maw={560} mx="auto">
        {loadingView ? (
          <Group align="center" justify="center" mih={120}>
            <Loader />
          </Group>
        ) : viewUser ? (
          <Stack gap="md">
            <Group align="center" justify="space-between">
              <Group>
                <Avatar src={viewUser.avatarUrl || '/default-avatar.png'} size={64} radius="xl" />
                <div>
                  <Title order={3}>{viewUser.username || `User #${viewUser.id}`}</Title>
                  <Group gap="xs" mt={4}>
                    <Badge variant="light">{(followStats?.followerCount ?? 0)} followers</Badge>
                    <Badge variant="light">{(followStats?.followingCount ?? 0)} following</Badge>
                    {followStats?.doTheyFollowMe ? <Badge color="blue" variant="light">Follows you</Badge> : null}
                  </Group>
                </div>
              </Group>
              <Group>
                {followStats?.amIFollowing ? (
                  <Button variant="light" color="red" loading={followBusy} onClick={doUnfollow}>
                    {t('profile.unfollow', 'Unfollow')}
                  </Button>
                ) : (
                  <Button variant="filled" loading={followBusy} onClick={doFollow}>
                    {t('profile.follow', 'Follow')}
                  </Button>
                )}
              </Group>
            </Group>

            <Divider />

            <Text c="dimmed" size="sm">
              {t(
                'profile.followHint',
                'Their stories will appear in your Following feed if they post with audience Followers (or Public).'
              )}
            </Text>
          </Stack>
        ) : (
          <Text c="dimmed">{t('profile.userNotFound', 'User not found')}</Text>
        )}
      </Paper>
    );
  }

  /* ------- own profile (settings) ------- */
  if (!currentUser) return <Text c="dimmed">{t('profile.mustLogin')}</Text>;

  const planUpper = (currentUser.plan || 'FREE').toUpperCase();
  const isPremium = planUpper === 'PREMIUM';

  // Themes — Free vs Premium from premiumConfig
  const freeThemes = premiumConfig.themes.free;        // ['light', 'dark']
  const premiumThemes = premiumConfig.themes.premium;  // ['amoled', 'neon', 'sunset', 'midnight', 'solarized']
  const toOption = (v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) });

  const themeOptions = [
    { group: 'Free', items: freeThemes.map(toOption) },
    {
      group: 'Premium',
      items: premiumThemes.map((v) => ({ ...toOption(v), disabled: !isPremium })),
    },
  ];

  const [preferredLanguage, setPreferredLanguage] = useState(currentUser.preferredLanguage || 'en');
  const [theme, setTheme] = useState(currentUser.theme || freeThemes[0]);
  const [allowExplicitContent, setAllowExplicitContent] = useState(currentUser.allowExplicitContent ?? true);
  const [enableReadReceipts, setEnableReadReceipts] = useState(currentUser.enableReadReceipts ?? false);
  const [autoDeleteSeconds, setAutoDeleteSeconds] = useState(currentUser.autoDeleteSeconds || 0);
  const [privacyBlurEnabled, setPrivacyBlurEnabled] = useState(currentUser.privacyBlurEnabled ?? false);
  const [privacyBlurOnUnfocus, setPrivacyBlurOnUnfocus] = useState(currentUser.privacyBlurOnUnfocus ?? false);
  const [privacyHoldToReveal, setPrivacyHoldToReveal] = useState(currentUser.privacyHoldToReveal ?? false);
  const [notifyOnCopy, setNotifyOnCopy] = useState(currentUser.notifyOnCopy ?? false);

  // keep current theme valid if plan changes
  useEffect(() => {
    const allowed = new Set([...freeThemes, ...(isPremium ? premiumThemes : [])]);
    if (!allowed.has(theme)) setTheme(freeThemes[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium]);

  const saveSettings = async () => {
    try {
      await axiosClient.patch(`/users/${currentUser.id}`, {
        preferredLanguage,
        theme,
        allowExplicitContent,
        enableReadReceipts,
        autoDeleteSeconds: parseInt(autoDeleteSeconds || 0, 10),
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
        allowExplicitContent,
        enableReadReceipts,
        autoDeleteSeconds: parseInt(autoDeleteSeconds || 0, 10),
        privacyBlurEnabled,
        privacyBlurOnUnfocus,
        privacyHoldToReveal,
        notifyOnCopy,
      }));

      notifications.show({ color: 'green', message: t('profile.saveSuccess', 'Settings saved') });
    } catch (error) {
      console.error('Failed to save settings', error);
      notifications.show({ color: 'red', message: t('profile.saveError', 'Failed to save settings') });
    }
  };

  const handleAvatarUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    // server route expects field name 'file' on /users/me/avatar (per Option B)
    formData.append('file', file);
    try {
      const { data } = await axiosClient.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.avatarUrl) {
        setCurrentUser((prev) => ({ ...prev, avatarUrl: data.avatarUrl }));
        notifications.show({ color: 'green', message: t('profile.avatarSuccess', 'Avatar updated') });
      } else {
        throw new Error('No avatarUrl returned');
      }
    } catch (err) {
      console.error('Avatar upload failed', err);
      notifications.show({ color: 'red', message: t('profile.avatarError', 'Failed to upload avatar') });
    }
  };

  const exportKey = async () => {
    try {
      const { privateKey } = await loadKeysLocal();
      if (!privateKey) {
        notifications.show({ color: 'red', message: t('profile.noPrivateKey', 'No private key found') });
        return;
      }
      const pwd = window.prompt(t('profile.setBackupPassword', 'Set a password to encrypt your backup'));
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

      notifications.show({ color: 'green', message: t('profile.backupDownloaded', 'Backup downloaded') });
    } catch (e) {
      console.error(e);
      notifications.show({ color: 'red', message: t('profile.exportFailed', 'Export failed') });
    }
  };

  const importKey = async (file) => {
    try {
      if (!file) return;
      const pwd = window.prompt(t('profile.enterBackupPassword', 'Enter your backup password'));
      if (!pwd) return;

      const privateKeyB64 = await importEncryptedPrivateKey(file, pwd);
      const existing = await loadKeysLocal();
      await saveKeysLocal({ publicKey: existing.publicKey, privateKey: privateKeyB64 });

      notifications.show({ color: 'green', message: t('profile.importSuccess', 'Backup imported successfully') });
      if (importFileRef.current) importFileRef.current.value = null;
    } catch (e) {
      console.error(e);
      notifications.show({ color: 'red', message: t('profile.importFailed', 'Import failed') });
    }
  };

  const rotateKeys = async () => {
    try {
      const kp = generateKeypair();
      await saveKeysLocal(kp);
      await axiosClient.post('/users/keys', { publicKey: kp.publicKey });
      setCurrentUser((prev) => ({ ...prev, publicKey: kp.publicKey }));
      notifications.show({ color: 'green', message: t('profile.keysRotated', 'Keys rotated') });
    } catch (e) {
      console.error(e);
      notifications.show({ color: 'red', message: t('profile.rotateFailed', 'Key rotation failed') });
    }
  };

  return (
    <Paper withBorder shadow="sm" radius="xl" p="lg" maw={560} mx="auto">
      <Group justify="space-between" align="center" mb="md">
        <Title order={3}>{t('profile.title', 'Profile')}</Title>
        <SectionBoundary fallbackText="Theme control failed to load">
          <Suspense fallback={null}>
            <LazyThemeToggle />
          </Suspense>
        </SectionBoundary>
      </Group>

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
            aria-label={t('profile.uploadAvatar', 'Upload avatar')}
            placeholder={t('profile.uploadAvatar', 'Upload avatar')}
            onChange={handleAvatarUpload}
          />
        </Group>

        <Divider />

        {/* Language */}
        <LanguageSelector
          currentLanguage={currentUser.preferredLanguage || 'en'}
          onChange={(lng) => {
            setCurrentUser((prev) => ({ ...prev, preferredLanguage: lng }));
            i18n.changeLanguage(lng);
            onLanguageChange?.(lng);
          }}
        />

        {/* Appearance */}
        <Divider label={t('profile.appearance', 'Appearance')} labelPosition="center" />
        {!isPremium && (
          <Card withBorder radius="lg" p="sm">
            <Text size="sm" c="blue.6">
              {t('profile.themeFreeNotice', 'You’re on Free—only Light & Dark are available. Upgrade to unlock more themes.')}
            </Text>
          </Card>
        )}
        <Select
          label={t('profile.theme', 'Theme')}
          value={theme}
          onChange={(v) => {
            if (!v) return;
            if (!isPremium && premiumThemes.includes(v)) {
              notifications.show({ color: 'blue', message: t('profile.themePremiumGate', 'Upgrade to use premium themes.') });
              return;
            }
            setTheme(v);
          }}
          data={themeOptions}
          withinPortal
        />

        {/* Sounds */}
        <Divider label={t('profile.soundSettings', 'Sounds')} labelPosition="center" />
        <SoundSettings />

        {/* Disappearing messages */}
        <Divider label={t('profile.disappearing', 'Disappearing messages')} labelPosition="center" />
        <Switch
          checked={autoDeleteSeconds > 0}
          onChange={(e) => setAutoDeleteSeconds(e.currentTarget.checked ? 10 : 0)}
          label={t('profile.disappearingMessages', 'Enable disappearing messages')}
        />
        {autoDeleteSeconds > 0 && (
          <>
            <NumberInput
              min={1}
              step={1}
              value={autoDeleteSeconds}
              onChange={(val) => setAutoDeleteSeconds(Number(val) || 0)}
              placeholder={t('profile.autoDeleteSeconds', 'Seconds until delete')}
              clampBehavior="strict"
            />
            <PremiumGuard silent>
              <AdvancedTtlControls value={autoDeleteSeconds} onChange={setAutoDeleteSeconds} />
            </PremiumGuard>
          </>
        )}

        {/* Backup & Sync (Premium) */}
        <Divider label="Backup & Sync" labelPosition="center" />
        <PremiumGuard>
          <Card withBorder radius="lg" p="md">
            <Group justify="space-between" align="center">
              <Group>
                <IconCloudUpload size={20} />
                <Text fw={600}>Encrypted Backups & Device Sync</Text>
              </Group>
              <Button variant="light" component="a" href="/settings/backups" aria-label="Open backup tools">
                {t('profile.openBackupTools', 'Open Backup Tools')}
              </Button>
            </Group>
            <Text size="sm" c="dimmed" mt="xs">
              {t('profile.backupDesc', 'Create password-protected backups of your keys, and restore on another device to sync.')}
            </Text>
          </Card>
        </PremiumGuard>

        {/* AI Settings (optional) */}
        <Divider label="AI" labelPosition="center" />
        <SectionBoundary fallbackText="AI settings failed to load">
          <Suspense fallback={null}>
            <LazyAISettings />
          </Suspense>
        </SectionBoundary>

        {/* Accessibility (optional) */}
        <Divider label="Accessibility" labelPosition="center" />
        <SectionBoundary fallbackText="Accessibility settings failed to load">
          <Suspense fallback={null}>
            <LazySettingsAccessibility />
          </Suspense>
        </SectionBoundary>

        {/* Privacy */}
        <Divider label={t('profile.privacy', 'Privacy')} labelPosition="center" />
        <PrivacySection />
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
          label={t('profile.holdToReveal', 'Hold to reveal')}
        />
        <Switch
          checked={notifyOnCopy}
          onChange={(e) => setNotifyOnCopy(e.currentTarget.checked)}
          label={t('profile.notifyOnCopy', 'Notify me if my message is copied')}
        />

        {/* Security */}
        <Divider label={t('profile.security', 'Security')} labelPosition="center" />
        <Group>
          <Button variant="light" onClick={exportKey} aria-label={t('profile.exportKey', 'Export key')}>
            {t('profile.exportKey', 'Export key')}
          </Button>
          <FileInput
            ref={importFileRef}
            accept="application/json"
            aria-label={t('profile.importKey', 'Import key')}
            placeholder={t('profile.importKey', 'Import key')}
            onChange={importKey}
          />
          <Button color="orange" variant="light" onClick={rotateKeys} aria-label={t('profile.rotateKeys', 'Rotate keys')}>
            {t('profile.rotateKeys', 'Rotate keys')}
          </Button>
        </Group>

        {/* Linked Devices */}
        <Divider label={t('profile.devices', 'Linked devices')} labelPosition="center" />
        <LinkedDevicesPanel />

        <Group justify="flex-end" mt="sm">
          <Button onClick={saveSettings}>{t('common.save', 'Save')}</Button>
        </Group>
      </Stack>
    </Paper>
  );
}

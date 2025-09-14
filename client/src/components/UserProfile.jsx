// import { useState, useRef, useEffect } from 'react';
// import { useParams } from 'react-router-dom';
// import LanguageSelector from './LanguageSelector';
// import axiosClient from '../api/axiosClient';
// import { useUser } from '../context/UserContext';
// import { useTranslation } from 'react-i18next';
// import i18n from '../i18n';
// import {
//   Paper,
//   Title,
//   Stack,
//   Group,
//   Text,
//   Button,
//   Switch,
//   FileInput,
//   NumberInput,
//   Avatar,
//   Alert,
//   Divider,
//   Select,
//   TextInput,
//   Card,
//   Badge,
//   Loader,
// } from '@mantine/core';
// import { DateTimePicker } from '@mantine/dates';
// import { IconUpload, IconCloudUpload, IconStars } from '@tabler/icons-react';
// import { loadKeysLocal, saveKeysLocal, generateKeypair } from '../utils/keys';
// import {
//   exportEncryptedPrivateKey,
//   importEncryptedPrivateKey,
// } from '../utils/keyBackup';
// import { setPref, PREF_SMART_REPLIES } from '../utils/prefsStore';
// import SoundSettings from './SoundSettings';
// import PremiumGuard from './PremiumGuard';

// function AdvancedTtlControls({ value, onChange }) {
//   const presets = [
//     { label: '1 hour', sec: 3600 },
//     { label: '8 hours', sec: 8 * 3600 },
//     { label: '24 hours', sec: 24 * 3600 },
//     { label: '3 days', sec: 3 * 24 * 3600 },
//     { label: '7 days', sec: 7 * 24 * 3600 },
//   ];
//   return (
//     <Group align="flex-end" gap="sm">
//       <NumberInput
//         label="Disappear after (seconds)"
//         min={1}
//         max={7 * 24 * 3600}
//         step={60}
//         value={value}
//         onChange={(v) => onChange(Number(v) || 0)}
//         clampBehavior="strict"
//       />
//       <Select
//         label="Presets"
//         placeholder="Choose…"
//         data={presets.map((p) => ({ value: String(p.sec), label: p.label }))}
//         onChange={(v) => v && onChange(Number(v))}
//         searchable
//       />
//     </Group>
//   );
// }

// export default function UserProfile({ onLanguageChange }) {
//   const { t } = useTranslation();
//   const { currentUser, setCurrentUser } = useUser();
//   const params = useParams();
//   const viewUserId = params.userId ? Number(params.userId) : null;
//   const viewingAnother = !!(viewUserId && currentUser && viewUserId !== currentUser.id);

//   const [loadingView, setLoadingView] = useState(viewingAnother);
//   const [viewUser, setViewUser] = useState(null);
//   const [followStats, setFollowStats] = useState(null);
//   const [followBusy, setFollowBusy] = useState(false);

//   // ------- Viewing another user's profile (Follow UX) -------
//   useEffect(() => {
//     let cancelled = false;
//     const fetchAll = async () => {
//       if (!viewingAnother) return;
//       setLoadingView(true);
//       try {
//         const [{ data: u }, { data: stats }] = await Promise.all([
//           axiosClient.get(`/users/${viewUserId}`),
//           axiosClient.get(`/follows/${viewUserId}/stats`),
//         ]);
//         if (!cancelled) {
//           setViewUser(u);
//           setFollowStats(stats);
//         }
//       } catch (e) {
//         console.error('load profile failed', e);
//       } finally {
//         if (!cancelled) setLoadingView(false);
//       }
//     };
//     fetchAll();
//     return () => { cancelled = true; };
//   }, [viewingAnother, viewUserId]);

//   const doFollow = async () => {
//     try {
//       setFollowBusy(true);
//       await axiosClient.post(`/follows/${viewUserId}`);
//       const { data: stats } = await axiosClient.get(`/follows/${viewUserId}/stats`);
//       setFollowStats(stats);
//     } finally {
//       setFollowBusy(false);
//     }
//   };
//   const doUnfollow = async () => {
//     try {
//       setFollowBusy(true);
//       await axiosClient.delete(`/follows/${viewUserId}`);
//       const { data: stats } = await axiosClient.get(`/follows/${viewUserId}/stats`);
//       setFollowStats(stats);
//     } finally {
//       setFollowBusy(false);
//     }
//   };

//   if (viewingAnother) {
//     return (
//       <Paper withBorder shadow="sm" radius="xl" p="lg" maw={560} mx="auto">
//         {loadingView ? (
//           <Group align="center" justify="center" mih={120}><Loader /></Group>
//         ) : viewUser ? (
//           <Stack gap="md">
//             <Group align="center" justify="space-between">
//               <Group>
//                 <Avatar src={viewUser.avatarUrl || '/default-avatar.png'} size={64} radius="xl" />
//                 <div>
//                   <Title order={3}>{viewUser.username || `User #${viewUser.id}`}</Title>
//                   <Group gap="xs" mt={4}>
//                     <Badge variant="light">{(followStats?.followerCount ?? 0)} followers</Badge>
//                     <Badge variant="light">{(followStats?.followingCount ?? 0)} following</Badge>
//                     {followStats?.doTheyFollowMe ? <Badge color="blue" variant="light">Follows you</Badge> : null}
//                   </Group>
//                 </div>
//               </Group>
//               <Group>
//                 {followStats?.amIFollowing ? (
//                   <Button variant="light" color="red" loading={followBusy} onClick={doUnfollow}>
//                     Unfollow
//                   </Button>
//                 ) : (
//                   <Button variant="filled" loading={followBusy} onClick={doFollow}>
//                     Follow
//                   </Button>
//                 )}
//               </Group>
//             </Group>

//             <Divider />

//             <Text c="dimmed" size="sm">
//               Their stories will appear in your <b>Following</b> feed if they post with audience <b>Followers</b> (or Public).
//             </Text>
//           </Stack>
//         ) : (
//           <Text c="dimmed">User not found</Text>
//         )}
//       </Paper>
//     );
//   }

//   // ------- Your own profile (existing settings UI) -------

//   if (!currentUser) {
//     return <Text c="dimmed">{t('profile.mustLogin')}</Text>;
//   }

//   const planUpper = (currentUser.plan || 'FREE').toUpperCase();
//   const isPremium = planUpper === 'PREMIUM';
//   const freeThemes = ['light', 'dark'];
//   const premiumThemes = ['solarized', 'midnight', 'vibrant'];
//   const themeChoices = isPremium ? [...freeThemes, ...premiumThemes] : freeThemes;
//   const themeOptions = themeChoices.map((v) => ({
//     value: v,
//     label: v.charAt(0).toUpperCase() + v.slice(1),
//   }));

//   const [preferredLanguage, setPreferredLanguage] = useState(
//     currentUser.preferredLanguage || 'en'
//   );
//   const [theme, setTheme] = useState(currentUser.theme || 'light');
//   const [showOriginalWithTranslation, setShowOriginalWithTranslation] =
//     useState(currentUser.showOriginalWithTranslation ?? true);
//   const [allowExplicitContent, setAllowExplicitContent] = useState(
//     currentUser.allowExplicitContent ?? true
//   );
//   const [enableAIResponder, setEnableAIResponder] = useState(
//     currentUser.enableAIResponder ?? false
//   );
//   const [autoResponderMode, setAutoResponderMode] = useState(
//     currentUser.autoResponderMode || 'off'
//   );
//   const [autoResponderCooldownSec, setAutoResponderCooldownSec] = useState(
//     Number.isFinite(currentUser.autoResponderCooldownSec)
//       ? currentUser.autoResponderCooldownSec
//       : 120
//   );
//   const [autoResponderSignature, setAutoResponderSignature] = useState(
//     currentUser.autoResponderSignature || '🤖 Auto-reply'
//   );
//   const [autoResponderActiveUntil, setAutoResponderActiveUntil] = useState(
//     currentUser.autoResponderActiveUntil
//       ? new Date(currentUser.autoResponderActiveUntil)
//       : null
//   );
//   const [enableReadReceipts, setEnableReadReceipts] = useState(
//     currentUser.enableReadReceipts ?? false
//   );
//   const [autoDeleteSeconds, setAutoDeleteSeconds] = useState(
//     currentUser.autoDeleteSeconds || 0
//   );

//   const [privacyBlurEnabled, setPrivacyBlurEnabled] = useState(
//     currentUser.privacyBlurEnabled ?? false
//   );
//   const [privacyBlurOnUnfocus, setPrivacyBlurOnUnfocus] = useState(
//     currentUser.privacyBlurOnUnfocus ?? false
//   );
//   const [privacyHoldToReveal, setPrivacyHoldToReveal] = useState(
//     currentUser.privacyHoldToReveal ?? false
//   );
//   const [notifyOnCopy, setNotifyOnCopy] = useState(
//     currentUser.notifyOnCopy ?? false
//   );

//   const [smartSaving, setSmartSaving] = useState(false);
//   const onToggleSmartReplies = async (checked) => {
//     setSmartSaving(true);
//     try {
//       const { data } = await axiosClient.patch('/users/me', {
//         enableSmartReplies: checked,
//       });
//       setCurrentUser((u) => ({
//         ...u,
//         enableSmartReplies: data.enableSmartReplies,
//       }));
//       await setPref(PREF_SMART_REPLIES, checked);
//     } catch (e) {
//       console.error('Failed to update Smart Replies', e);
//     } finally {
//       setSmartSaving(false);
//     }
//   };

//   const [statusMessage, setStatusMessage] = useState('');
//   const [statusType, setStatusType] = useState('');
//   const importFileRef = useRef(null);

//   const setStatus = (msg, type = 'success') => {
//     setStatusMessage(msg);
//     setStatusType(type);
//     setTimeout(() => {
//       setStatusMessage('');
//       setStatusType('');
//     }, 3500);
//   };

//   const saveSettings = async () => {
//     try {
//       await axiosClient.patch(`/users/${currentUser.id}`, {
//         preferredLanguage,
//         theme,
//         showOriginalWithTranslation,
//         allowExplicitContent,
//         enableAIResponder,
//         enableReadReceipts,
//         autoDeleteSeconds: parseInt(autoDeleteSeconds || 0, 10),
//         autoResponderMode,
//         autoResponderCooldownSec: Number(autoResponderCooldownSec) || 120,
//         autoResponderSignature,
//         autoResponderActiveUntil: autoResponderActiveUntil
//           ? autoResponderActiveUntil.toISOString()
//           : null,
//         privacyBlurEnabled,
//         privacyBlurOnUnfocus,
//         privacyHoldToReveal,
//         notifyOnCopy,
//       });

//       i18n.changeLanguage(preferredLanguage);
//       onLanguageChange?.(preferredLanguage);

//       setCurrentUser((prev) => ({
//         ...prev,
//         preferredLanguage,
//         theme,
//         showOriginalWithTranslation,
//         allowExplicitContent,
//         enableAIResponder,
//         enableReadReceipts,
//         autoDeleteSeconds: parseInt(autoDeleteSeconds || 0, 10),
//         autoResponderMode,
//         autoResponderCooldownSec: Number(autoResponderCooldownSec) || 120,
//         autoResponderSignature,
//         autoResponderActiveUntil: autoResponderActiveUntil
//           ? autoResponderActiveUntil.toISOString()
//           : null,
//         privacyBlurEnabled,
//         privacyBlurOnUnfocus,
//         privacyHoldToReveal,
//         notifyOnCopy,
//       }));

//       setStatus(t('profile.saveSuccess', 'Settings saved'), 'success');
//     } catch (error) {
//       console.error('Failed to save settings', error);
//       setStatus(t('profile.saveError', 'Failed to save settings'), 'error');
//     }
//   };

//   const handleAvatarUpload = async (file) => {
//     if (!file) return;
//     const formData = new FormData();
//     formData.append('avatar', file);
//     try {
//       const { data } = await axiosClient.post('/users/avatar', formData, {
//         headers: { 'Content-Type': 'multipart/form-data' },
//       });
//       if (data.avatarUrl) {
//         setCurrentUser((prev) => ({ ...prev, avatarUrl: data.avatarUrl }));
//         setStatus(t('profile.avatarSuccess', 'Avatar updated'), 'success');
//       } else {
//         throw new Error('No avatarUrl returned');
//       }
//     } catch (err) {
//       console.error('Avatar upload failed', err);
//       setStatus(t('profile.avatarError', 'Failed to upload avatar'), 'error');
//     }
//   };

//   const exportKey = async () => {
//     try {
//       const { privateKey } = await loadKeysLocal();
//       if (!privateKey) {
//         setStatus(t('profile.noPrivateKey', 'No private key found'), 'error');
//         return;
//       }
//       const pwd = window.prompt(
//         t('profile.setBackupPassword', 'Set a password to encrypt your backup')
//       );
//       if (!pwd) return;

//       const blob = await exportEncryptedPrivateKey(privateKey, pwd);
//       const url = URL.createObjectURL(blob);
//       const a = document.createElement('a');
//       a.href = url;
//       a.download = 'chat-orbit-key.backup.json';
//       document.body.appendChild(a);
//       a.click();
//       a.remove();
//       URL.revokeObjectURL(url);

//       setStatus(t('profile.backupDownloaded', 'Backup downloaded'));
//     } catch (e) {
//       console.error(e);
//       setStatus(t('profile.exportFailed', 'Export failed'), 'error');
//     }
//   };

//   const importKey = async (file) => {
//     try {
//       if (!file) return;
//       const pwd = window.prompt(
//         t('profile.enterBackupPassword', 'Enter your backup password')
//       );
//       if (!pwd) return;

//       const privateKeyB64 = await importEncryptedPrivateKey(file, pwd);
//       const existing = await loadKeysLocal();
//       await saveKeysLocal({
//         publicKey: existing.publicKey,
//         privateKey: privateKeyB64,
//       });

//       setStatus(t('profile.importSuccess', 'Backup imported successfully'));
//       if (importFileRef.current) importFileRef.current.value = null;
//     } catch (e) {
//       console.error(e);
//       setStatus(t('profile.importFailed', 'Import failed'), 'error');
//     }
//   };

//   const rotateKeys = async () => {
//     try {
//       const kp = generateKeypair();
//       await saveKeysLocal(kp);
//       await axiosClient.post('/users/keys', { publicKey: kp.publicKey });
//       setCurrentUser((prev) => ({ ...prev, publicKey: kp.publicKey }));
//       setStatus(t('profile.keysRotated', 'Keys rotated'));
//     } catch (e) {
//       console.error(e);
//       setStatus(t('profile.rotateFailed', 'Key rotation failed'), 'error');
//     }
//   };

//   return (
//     <Paper withBorder shadow="sm" radius="xl" p="lg" maw={560} mx="auto">
//       <Title order={3} mb="md">
//         {t('profile.title', 'Profile')}
//       </Title>

//       <Stack gap="md">
//         {/* Avatar */}
//         <Group align="center">
//           <Avatar
//             src={currentUser.avatarUrl || '/default-avatar.png'}
//             alt={t('profile.avatarAlt', 'Avatar')}
//             size={64}
//             radius="xl"
//           />
//           <FileInput
//             accept="image/*"
//             leftSection={<IconUpload size={16} />}
//             placeholder={t('profile.uploadAvatar', 'Upload avatar')}
//             onChange={handleAvatarUpload}
//           />
//         </Group>

//         <Divider />

//         {/* Language */}
//         <LanguageSelector
//           currentLanguage={preferredLanguage}
//           onChange={setPreferredLanguage}
//         />

//         {/* Appearance */}
//         <Divider label={t('profile.appearance', 'Appearance')} labelPosition="center" />
//         {!isPremium && (
//           <Alert variant="light" color="blue">
//             {t(
//               'profile.themeFreeNotice',
//               'You’re on Free—only Light & Dark are available. Upgrade to unlock more themes.'
//             )}
//           </Alert>
//         )}
//         <Select
//           label={t('profile.theme', 'Theme')}
//           value={theme}
//           onChange={(v) => v && setTheme(v)}
//           data={themeOptions}
//           withinPortal
//         />

//         {/* General toggles */}
//         <Switch
//           checked={showOriginalWithTranslation}
//           onChange={(e) =>
//             setShowOriginalWithTranslation(e.currentTarget.checked)
//           }
//           label={t(
//             'profile.showOriginalWithTranslation',
//             'Show original with translation'
//           )}
//         />
//         <Switch
//           checked={!allowExplicitContent}
//           onChange={(e) => setAllowExplicitContent(!e.currentTarget.checked)}
//           label={t('profile.filterExplicit', 'Filter explicit content')}
//         />
//         <Switch
//           checked={enableReadReceipts}
//           onChange={(e) => setEnableReadReceipts(e.currentTarget.checked)}
//           label={t('profile.readReceipts', 'Read receipts')}
//         />

//         {/* Smart Replies */}
//         <Switch
//           checked={!!currentUser?.enableSmartReplies}
//           onChange={(e) => onToggleSmartReplies(e.currentTarget.checked)}
//           disabled={smartSaving}
//           label={t('profile.smartReplies', 'Enable Smart Replies')}
//           description={t(
//             'profile.smartRepliesDesc',
//             'Sends the last few received messages to AI to suggest quick replies.'
//           )}
//         />

//         {/* Sounds */}
//         <Divider label={t('profile.soundSettings', 'Sounds')} labelPosition="center" />
//         <SoundSettings />

//         <Divider label={t('profile.autoResponder', 'Auto-responder')} labelPosition="center" />

//         <Switch
//           checked={enableAIResponder}
//           onChange={(e) => setEnableAIResponder(e.currentTarget.checked)}
//           label={t('profile.aiReply', 'OrbitBot auto-reply when I’m busy')}
//         />

//         <Select
//           label={t('profile.autoReplyMode', 'Auto-reply mode')}
//           value={autoResponderMode}
//           onChange={setAutoResponderMode}
//           data={[
//             { value: 'dm', label: t('profile.autoReplyDm', '1:1 chats only') },
//             { value: 'mention', label: t('profile.autoReplyMention', 'Only when I’m @mentioned') },
//             { value: 'all', label: t('profile.autoReplyAll', 'All inbound messages') },
//             { value: 'off', label: t('common.off', 'Off') },
//           ]}
//           disabled={!enableAIResponder}
//           withinPortal
//         />

//         <NumberInput
//           label={t('profile.cooldown', 'Cooldown (seconds)')}
//           min={10}
//           value={autoResponderCooldownSec}
//           onChange={(v) => setAutoResponderCooldownSec(Number(v) || 120)}
//           disabled={!enableAIResponder}
//         />

//         <TextInput
//           label={t('profile.signature', 'Signature')}
//           value={autoResponderSignature}
//           onChange={(e) => setAutoResponderSignature(e.target.value)}
//           placeholder={t('profile.signaturePh', '🤖 Auto-reply')}
//           disabled={!enableAIResponder}
//         />

//         <DateTimePicker
//           label={t('profile.activeUntil', 'Active until (optional)')}
//           value={autoResponderActiveUntil}
//           onChange={setAutoResponderActiveUntil}
//           disabled={!enableAIResponder}
//           clearable
//         />

//         {/* Disappearing messages */}
//         <Divider label={t('profile.disappearing', 'Disappearing messages')} labelPosition="center" />
//         <Switch
//           checked={autoDeleteSeconds > 0}
//           onChange={(e) => setAutoDeleteSeconds(e.currentTarget.checked ? 10 : 0)}
//           label={t('profile.disappearingMessages', 'Enable disappearing messages')}
//         />

//         {autoDeleteSeconds > 0 && (
//           <NumberInput
//             min={1}
//             step={1}
//             value={autoDeleteSeconds}
//             onChange={(val) => setAutoDeleteSeconds(Number(val) || 0)}
//             placeholder={t('profile.autoDeleteSeconds', 'Seconds until delete')}
//             clampBehavior="strict"
//           />
//         )}

//         {autoDeleteSeconds > 0 && (
//           <PremiumGuard silent>
//             <AdvancedTtlControls
//               value={autoDeleteSeconds}
//               onChange={setAutoDeleteSeconds}
//             />
//           </PremiumGuard>
//         )}

//         {/* ===== Backup & Sync (Premium) ===== */}
//         <Divider label="Backup & Sync" labelPosition="center" />

//         <PremiumGuard>
//           <Card withBorder radius="lg" p="md">
//             <Group justify="space-between" align="center">
//               <Group>
//                 <IconCloudUpload size={20} />
//                 <Text fw={600}>Encrypted Backups & Device Sync</Text>
//               </Group>
//               <Button variant="light" component="a" href="/settings/backups">
//                 Open Backup Tools
//               </Button>
//             </Group>
//             <Text size="sm" c="dimmed" mt="xs">
//               Create password-protected backups of your keys, and restore on another device to sync.
//             </Text>
//           </Card>
//         </PremiumGuard>

//         <PremiumGuard variant="inline" silent>
//           {/* upsell placeholder */}
//         </PremiumGuard>

//         {/* ===== Priority Updates (Premium) ===== */}
//         <PremiumGuard>
//           <Card withBorder radius="lg" p="md">
//             <Group gap="xs" align="center">
//               <IconStars size={18} />
//               <Text fw={600}>Priority Updates</Text>
//             </Group>
//             <Text size="sm" c="dimmed" mt="xs">
//               Premium members receive new features and improvements first. No action needed — it’s automatic.
//             </Text>
//           </Card>
//         </PremiumGuard>

//         <PremiumGuard variant="inline" silent={false}>
//           <Card withBorder radius="lg" p="md">
//             <Group justify="space-between" align="center">
//               <Group gap="xs" align="center">
//                 <IconStars size={18} />
//                 <Text fw={600}>Priority Updates</Text>
//               </Group>
//               <Button color="yellow" variant="light" component="a" href="/settings/upgrade">
//                 Upgrade
//               </Button>
//             </Group>
//             <Text size="sm" c="dimmed" mt="xs">
//               Get early access to new features and improvements.
//             </Text>
//           </Card>
//         </PremiumGuard>

//         {/* Privacy */}
//         <Divider label={t('profile.privacy', 'Privacy')} labelPosition="center" />
//         <Switch
//           checked={privacyBlurEnabled}
//           onChange={(e) => setPrivacyBlurEnabled(e.currentTarget.checked)}
//           label={t('profile.privacyBlurEnabled', 'Blur messages by default')}
//         />
//         <Switch
//           checked={privacyBlurOnUnfocus}
//           onChange={(e) => setPrivacyBlurOnUnfocus(e.currentTarget.checked)}
//           label={t('profile.privacyBlurOnUnfocus', 'Blur when app is unfocused')}
//         />
//         <Switch
//           checked={privacyHoldToReveal}
//           onChange={(e) => setPrivacyHoldToReveal(e.currentTarget.checked)}
//           label={t('profile.holdToReveal', 'Hold to reveal')}
//         />
//         <Switch
//           checked={notifyOnCopy}
//           onChange={(e) => setNotifyOnCopy(e.currentTarget.checked)}
//           label={t('profile.notifyOnCopy', 'Notify me if my message is copied')}
//         />

//         {/* Security */}
//         <Divider label={t('profile.security', 'Security')} labelPosition="center" />
//         <Group>
//           <Button variant="light" onClick={exportKey}>
//             {t('profile.exportKey', 'Export key')}
//           </Button>
//           <FileInput
//             ref={importFileRef}
//             accept="application/json"
//             placeholder={t('profile.importKey', 'Import key')}
//             onChange={importKey}
//           />
//           <Button color="orange" variant="light" onClick={rotateKeys}>
//             {t('profile.rotateKeys', 'Rotate keys')}
//           </Button>
//         </Group>
//         <Text size="xs" c="dimmed">
//           {t('profile.keyDisclaimer', 'Keep your keys safe.')}
//         </Text>

//         {statusMessage && (
//           <Alert color={statusType === 'error' ? 'red' : 'green'} variant="light">
//             {statusMessage}
//           </Alert>
//         )}

//         <Group justify="flex-end" mt="sm">
//           <Button onClick={saveSettings}>{t('common.save', 'Save')}</Button>
//         </Group>
//       </Stack>
//     </Paper>
//   );
// }

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
  Divider,
  Select,
  Card,
  Loader,
  Badge,
  useMantineColorScheme,
} from '@mantine/core';
import { IconUpload, IconCloudUpload } from '@tabler/icons-react';
import { loadKeysLocal, saveKeysLocal, generateKeypair } from '../utils/keys';
import {
  exportEncryptedPrivateKey,
  importEncryptedPrivateKey,
} from '../utils/keyBackup';
import { toast } from '../utils/toast';
import SoundSettings from './SoundSettings';
import PremiumGuard from './PremiumGuard';
import SettingsAccessibility from '../pages/SettingsAccessibility';
import AISettings from "@/pages/AISettings";
import ThemeToggle from '@/components/ThemeToggle';

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

export default function UserProfile({ onLanguageChange }) {
  const { t } = useTranslation();
  const { currentUser, setCurrentUser } = useUser();
  const params = useParams();
  const viewUserId = params.userId ? Number(params.userId) : null;
  const viewingAnother = !!(viewUserId && currentUser && viewUserId !== currentUser.id);

  const { setColorScheme } = useMantineColorScheme();
  const importFileRef = useRef(null);

  // ------- Viewing another user's profile (Follow UX) -------
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
        toast.err(t('profile.loadFailed', 'Failed to load profile'));
      } finally {
        if (!cancelled) setLoadingView(false);
      }
    };
    fetchAll();
    return () => { cancelled = true; };
  }, [viewingAnother, viewUserId, t]);

  const doFollow = async () => {
    try {
      setFollowBusy(true);
      await axiosClient.post(`/follows/${viewUserId}`);
      const { data: stats } = await axiosClient.get(`/follows/${viewUserId}/stats`);
      setFollowStats(stats);
      toast.ok(t('profile.followed', 'Followed'));
    } catch (e) {
      console.error(e);
      toast.err(t('profile.followFailed', 'Failed to follow'));
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
      toast.ok(t('profile.unfollowed', 'Unfollowed'));
    } catch (e) {
      console.error(e);
      toast.err(t('profile.unfollowFailed', 'Failed to unfollow'));
    } finally {
      setFollowBusy(false);
    }
  };

  if (viewingAnother) {
    return (
      <Paper withBorder shadow="sm" radius="xl" p="lg" maw={560} mx="auto">
        {loadingView ? (
          <Group align="center" justify="center" mih={120}><Loader /></Group>
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

  // ------- Your own profile (settings) -------
  if (!currentUser) return <Text c="dimmed">{t('profile.mustLogin')}</Text>;

  const planUpper = (currentUser.plan || 'FREE').toUpperCase();
  const isPremium = planUpper === 'PREMIUM';
  const freeThemes = ['light', 'dark'];
  const premiumThemes = ['solarized', 'midnight', 'vibrant'];
  const themeChoices = isPremium ? [...freeThemes, ...premiumThemes] : freeThemes;
  const themeOptions = themeChoices.map((v) => ({
    value: v,
    label: v.charAt(0).toUpperCase() + v.slice(1),
  }));

  const [preferredLanguage, setPreferredLanguage] = useState(
    currentUser.preferredLanguage || 'en'
  );
  const [theme, setTheme] = useState(currentUser.theme || 'light');
  const [allowExplicitContent, setAllowExplicitContent] = useState(
    currentUser.allowExplicitContent ?? true
  );
  const [enableReadReceipts, setEnableReadReceipts] = useState(
    currentUser.enableReadReceipts ?? false
  );
  const [autoDeleteSeconds, setAutoDeleteSeconds] = useState(
    currentUser.autoDeleteSeconds || 0
  );
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

      toast.ok(t('profile.saveSuccess', 'Settings saved'));
    } catch (error) {
      console.error('Failed to save settings', error);
      toast.err(t('profile.saveError', 'Failed to save settings'));
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
        toast.ok(t('profile.avatarSuccess', 'Avatar updated'));
      } else {
        throw new Error('No avatarUrl returned');
      }
    } catch (err) {
      console.error('Avatar upload failed', err);
      toast.err(t('profile.avatarError', 'Failed to upload avatar'));
    }
  };

  const exportKey = async () => {
    try {
      const { privateKey } = await loadKeysLocal();
      if (!privateKey) {
        toast.err(t('profile.noPrivateKey', 'No private key found'));
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

      toast.ok(t('profile.backupDownloaded', 'Backup downloaded'));
    } catch (e) {
      console.error(e);
      toast.err(t('profile.exportFailed', 'Export failed'));
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

      toast.ok(t('profile.importSuccess', 'Backup imported successfully'));
      if (importFileRef.current) importFileRef.current.value = null;
    } catch (e) {
      console.error(e);
      toast.err(t('profile.importFailed', 'Import failed'));
    }
  };

  const rotateKeys = async () => {
    try {
      const kp = generateKeypair();
      await saveKeysLocal(kp);
      await axiosClient.post('/users/keys', { publicKey: kp.publicKey });
      setCurrentUser((prev) => ({ ...prev, publicKey: kp.publicKey }));
      toast.ok(t('profile.keysRotated', 'Keys rotated'));
    } catch (e) {
      console.error(e);
      toast.err(t('profile.rotateFailed', 'Key rotation failed'));
    }
  };

  return (
    <Paper withBorder shadow="sm" radius="xl" p="lg" maw={560} mx="auto">
      <Group justify="space-between" align="center" mb="md">
        <Title order={3}>
          {t('profile.title', 'Profile')}
        </Title>
        <ThemeToggle />
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
            setPreferredLanguage(lng);
          }}
        />

        {/* Appearance */}
        <Divider label={t('profile.appearance', 'Appearance')} labelPosition="center" />
        {!isPremium && (
          <Card withBorder radius="lg" p="sm">
            <Text size="sm" c="blue.6">
              {t(
                'profile.themeFreeNotice',
                'You’re on Free—only Light & Dark are available. Upgrade to unlock more themes.'
              )}
            </Text>
          </Card>
        )}
        <Select
          label={t('profile.theme', 'Theme')}
          value={theme}
          onChange={(v) => {
            if (!v) return;
            setTheme(v);
            // Apply immediately on the client
            if (v === 'light' || v === 'dark') {
              setColorScheme(v);
              try {
                localStorage.setItem('co-theme', v);
                document.documentElement.setAttribute('data-theme', v);
                document.documentElement.removeAttribute('data-theme-preset');
              } catch {}
            } else {
              // premium presets -> a lightweight CSS preset
              try {
                document.documentElement.setAttribute('data-theme-preset', v);
              } catch {}
            }
          }}
          data={themeOptions}
          withinPortal
        />

        {/* General toggles */}
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
          <NumberInput
            min={1}
            step={1}
            value={autoDeleteSeconds}
            onChange={(val) => setAutoDeleteSeconds(Number(val) || 0)}
            placeholder={t('profile.autoDeleteSeconds', 'Seconds until delete')}
            clampBehavior="strict"
          />
        )}

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
              <Button variant="light" component="a" href="/settings/backups" aria-label="Open backup tools">
                {t('profile.openBackupTools', 'Open Backup Tools')}
              </Button>
            </Group>
            <Text size="sm" c="dimmed" mt="xs">
              {t('profile.backupDesc', 'Create password-protected backups of your keys, and restore on another device to sync.')}
            </Text>
          </Card>
        </PremiumGuard>

        {/* ===== AI Settings & Accessibility ===== */}
        <Divider label="AI" labelPosition="center" />
        <AISettings />

        <Divider label="Accessibility" labelPosition="center" />
        <SettingsAccessibility />

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
        <Text size="xs" c="dimmed">
          {t('profile.keyDisclaimer', 'Keep your keys safe.')}
        </Text>

        <Group justify="flex-end" mt="sm">
          <Button onClick={saveSettings}>{t('common.save', 'Save')}</Button>
        </Group>

        <PremiumGuard variant="inline" silent />
      </Stack>
    </Paper>
  );
}

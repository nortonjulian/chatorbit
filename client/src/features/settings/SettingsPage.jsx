import { Stack, Title, Divider } from '@mantine/core';
import SoundSettings from '@/components/SoundSettings';
import ThemePicker from '@/features/settings/ThemePicker';
import PrivacyToggles from '@/features/settings/PrivacyToggles';
import AgeSettings from '@/features/settings/AgeSettings';
import ForwardingSettings from '@/features/settings/ForwardingSettings.jsx';

export default function SettingsPage() {
  return (
    <Stack gap="lg">
      {/* Appearance */}
      <Title order={3}>Appearance</Title>
      <ThemePicker />

      <Divider />

      {/* Notification Sounds */}
      <Title order={3}>Notification Sounds</Title>
      <SoundSettings />

      <Divider />

      {/* Privacy */}
      <Title order={3}>Privacy</Title>
      <PrivacyToggles />

      <Divider />

      {/* Safety & Age */}
      <Title order={3}>Safety &amp; Age</Title>
      <AgeSettings />

      <Divider />

      {/* Call & Text Forwarding */}
      <Title order={3}>Call &amp; Text Forwarding</Title>
      <ForwardingSettings />
    </Stack>
  );
}

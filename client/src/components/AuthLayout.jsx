import { Outlet, Link } from 'react-router-dom';
import {
  Container,
  Grid,
  Stack,
  Title,
  Text,
  Image,
  ThemeIcon,
  List,
  Anchor,
  Group,
  Button,
  Paper,
  Divider,
  Box,
} from '@mantine/core';
import { Lock, Globe, MessageCircle, ShieldCheck } from 'lucide-react';

// 🔗 Smart links (replace with your real domains or provider links)
const APP_GENERIC = 'https://go.chatorbit.com/app';      // QR uses this (auto-route based on device)
const APP_IOS     = 'https://go.chatorbit.com/ios';      // Force App Store
const APP_ANDROID = 'https://go.chatorbit.com/android';  // Force Google Play

// Reusable row shown under the auth forms (QR + store badges)
function DownloadAppRow() {
  // Responsive sizes:
  // - badges: 52–72px tall depending on viewport
  // - QR: a bit larger than the badge
  const BADGE_H = 'clamp(52px, 6vw, 72px)';
  const QR_SIZE = 'calc(1.1 * (clamp(52px, 6vw, 72px)))';

  return (
    <Box mt="lg">
      <Divider my="sm" label="Get the app" />
      <Group justify="space-between" wrap="nowrap" align="center">
        {/* QR: desktop/tablet only */}
        <Group gap="sm" align="center" visibleFrom="sm">
          <Anchor
            href={APP_GENERIC}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the download link"
            style={{ display: 'inline-flex', padding: 6, borderRadius: 12 }}
          >
            <Image
              src="/qr-chatorbit.png"
              alt="Scan to get ChatOrbit"
              h={QR_SIZE}
              w={QR_SIZE}
              radius="md"
            />
          </Anchor>
          <Text size="sm" c="dimmed" maw={260}>
            On desktop? Scan with your phone to get the app.
          </Text>
        </Group>

        {/* Store badges: always visible & larger */}
        <Group gap="md" wrap="wrap" align="center" style={{ rowGap: 12 }}>
          <Anchor
            href={APP_IOS}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Download on the App Store"
            title="Download on the App Store"
            style={{ display: 'inline-flex', padding: 6, borderRadius: 12 }}
          >
            <Image
              src="/badges/app-store-badge.png"  // or your SVG import
              h={BADGE_H}
              fit="contain"
              alt="Download on the App Store"
              style={{ width: 'auto' }}
            />
          </Anchor>

          <Anchor
            href={APP_ANDROID}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Get it on Google Play"
            title="Get it on Google Play"
            style={{ display: 'inline-flex', padding: 6, borderRadius: 12 }}
          >
            <Image
              src="/badges/google-play-badge.png"
              h={BADGE_H}
              fit="contain"
              alt="Get it on Google Play"
              style={{ width: 'auto' }}
            />
          </Anchor>
        </Group>
      </Group>
    </Box>
  );
}

export default function AuthLayout() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(1200px 600px at 10% -10%, rgba(65,138,255,0.18), transparent), radial-gradient(900px 500px at 110% 110%, rgba(255,216,110,0.15), transparent)',
      }}
    >
      <Container size="lg" py="xl">
        <Grid gutter="xl" align="start">
          {/* Left: Brand + Features (ONE logo here) */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="md" maw={520}>
              <Group gap="sm" align="center">
                <Image
                  src="/ChatOrbit (possible).png"
                  alt="ChatOrbit logo"
                  h={44}
                  fit="contain"
                  radius="md"
                />
                <Title order={3} c="orbit.8" style={{ marginBottom: 0 }}>
                  ChatOrbit
                </Title>
              </Group>

              <Title order={1} style={{ lineHeight: 1.1 }}>
                Secure, global messaging with{' '}
                <span style={{ color: 'var(--mantine-color-orbit-6)' }}>
                  instant translation
                </span>
              </Title>

              <Text c="dimmed" size="lg">
                End-to-end encryption, AI-powered translation, disappearing messages, and voice/video calling.
              </Text>

              <List spacing="sm" size="sm" center>
                <List.Item icon={<ThemeIcon variant="light" color="orbit"><Lock size={16} /></ThemeIcon>}>
                  End-to-end encryption by default
                </List.Item>
                <List.Item icon={<ThemeIcon variant="light" color="orbit"><Globe size={16} /></ThemeIcon>}>
                  Auto-translate 100+ languages
                </List.Item>
                <List.Item icon={<ThemeIcon variant="light" color="orbit"><MessageCircle size={16} /></ThemeIcon>}>
                  Disappearing messages & read receipts
                </List.Item>
                <List.Item icon={<ThemeIcon variant="light" color="orbit"><ShieldCheck size={16} /></ThemeIcon>}>
                  Privacy-first. Your data, your control.
                </List.Item>
              </List>

              <Group gap="sm">
                <Button component={Link} to="/register" size="md">
                  Create free account
                </Button>
                <Anchor component={Link} to="/status" c="dimmed">
                  Status
                </Anchor>
                <Anchor component={Link} to="/settings/upgrade" c="dimmed">
                  Upgrade
                </Anchor>
              </Group>

              <Paper p="sm" withBorder radius="md">
                <Text size="xs" c="dimmed">
                  Tip: Use the same account on web and mobile. Your messages stay synced.
                </Text>
              </Paper>
            </Stack>
          </Grid.Col>

          {/* Right: Auth form + Download section */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="lg" style={{ maxWidth: 420, marginLeft: 'auto' }}>
              {/* Form content from the child route (login / register / forgot / reset) */}
              <Outlet />

              {/* App download row (QR + badges) */}
              <DownloadAppRow />
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>
    </div>
  );
}

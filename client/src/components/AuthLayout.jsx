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

// Smart links (update to your live URLs when ready)
const APP_GENERIC = 'https://go.chatorbit.com/app';      // QR (auto-routes)
const APP_IOS     = 'https://go.chatorbit.com/ios';      // App Store
const APP_ANDROID = 'https://go.chatorbit.com/android';  // Google Play

// Mobile-only brand bar (shown when the left hero is hidden)
function MobileTopBar() {
  return (
    <Group
      hiddenFrom="md"
      gap="xs"
      align="center"
      wrap="nowrap"
      className="brand-lockup"
      py="sm"
    >
      <Image src="/logo-chatorbit.png" alt="ChatOrbit" h={28} />
      <Title order={4} c="orbit.8" style={{ margin: 0 }}>ChatOrbit</Title>
    </Group>
  );
}

function GetAppCard() {
  const BADGE_H = 'clamp(52px, 6vw, 72px)';
  const QR_SIZE = 'calc(1.1 * (clamp(52px, 6vw, 72px)))';

  return (
    <Paper withBorder shadow="xs" radius="xl" p="md">
      <Divider mb="md" label="Get the app" />
      <Group justify="space-between" wrap="nowrap" align="center">
        {/* QR: show on tablet/desktop */}
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
          <Text size="sm" c="dimmed" maw={240}>
            On desktop? Scan with your phone to get the app.
          </Text>
        </Group>

        {/* Badges: always visible & large hit targets */}
        <Stack gap="sm" align="stretch" style={{ minWidth: 260 }}>
          <Anchor
            href={APP_IOS}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Download on the App Store"
            title="Download on the App Store"
            style={{ display: 'inline-flex', padding: 6, borderRadius: 12 }}
          >
            <Image
              src="/badges/app-store-badge.png"
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
        </Stack>
      </Group>
    </Paper>
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
        {/* Mobile brand bar */}
        <MobileTopBar />

        <Grid gutter="xl" align="start">
          {/* Left: Brand + Marketing (desktop/tablet only) */}
          <Grid.Col
            span={{ base: 12, md: 6, lg: 7 }}   // <-- add md split
            visibleFrom="md"
          >
            <Stack gap="md" maw={620}>
              <Group gap="sm" align="center" wrap="nowrap" className="brand-lockup">
                <Image
                  src="/logo-chatorbit.png"
                  alt="ChatOrbit logo"
                  h={44}
                  fit="contain"
                />
                <Title order={3} c="orbit.8" style={{ marginBottom: 0 }}>
                  ChatOrbit
                </Title>
              </Group>

              <Title
                order={1}
                style={{
                  lineHeight: 1.05,
                  fontWeight: 800,
                  letterSpacing: -0.2,
                  fontSize: 'clamp(34px, 5vw, 56px)',
                }}
              >
                Secure, global messaging with{' '}
                <span style={{ color: 'var(--mantine-color-orbit-6)' }}>
                  instant translation
                </span>
              </Title>

              <Text c="dimmed" size="lg" style={{ maxWidth: 560 }}>
                End-to-end encryption, AI-powered translation, disappearing
                messages, and voice/video calling.
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
                <Button component={Link} to="/register" size="md" radius="xl">
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

          {/* Right: Auth form + Get app */}
          <Grid.Col
            span={{ base: 12, md: 6, lg: 5 }}   // <-- add md split
            style={{ alignSelf: 'start' }}
          >
            <Stack gap="lg" style={{ maxWidth: 440, marginLeft: 'auto' }}>
              <Outlet />   {/* Login / Register / Forgot / Reset (card-only) */}
              <GetAppCard />
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>
    </div>
  );
}

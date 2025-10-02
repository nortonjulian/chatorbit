import { useEffect } from 'react';
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
} from '@mantine/core';
import { Lock, Globe, MessageCircle, ShieldCheck } from 'lucide-react';
import BrandLockup from '@/components/BrandLockup';

// Smart links (update to your live URLs when ready)
const APP_GENERIC = 'https://go.chatforia.com/app';      // QR (auto-routes)
const APP_IOS     = 'https://go.chatforia.com/ios';      // App Store
const APP_ANDROID = 'https://go.chatforia.com/android';  // Google Play

const CYCLE_MS = 12000; // flip Light <-> Midnight every 12s

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
      <Title order={4} className="text-blue-purple" style={{ margin: 0 }}>
        Chatforia
      </Title>
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
              src="/qr-chatforia.png"
              alt="Scan to get Chatforia"
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
  // Auto-cycle the global theme on this page, and restore when unmounting
  useEffect(() => {
    const html = document.documentElement;

    const originalTheme = html.getAttribute('data-theme') || 'light';
    const originalCTA = html.getAttribute('data-cta'); // maybe "cool" or null

    function apply(theme) {
      html.setAttribute('data-theme', theme);
      // Convention: Light uses cool (blue→purple), Midnight uses warm (gold→purple)
      if (theme === 'midnight') {
        html.removeAttribute('data-cta'); // warm is default via tokens
      } else {
        html.setAttribute('data-cta', 'cool');
      }
    }

    let next = originalTheme === 'midnight' ? 'light' : 'midnight';
    const id = setInterval(() => {
      apply(next);
      next = next === 'midnight' ? 'light' : 'midnight';
    }, CYCLE_MS);

    // ensure first render matches the user's starting theme cleanly
    apply(originalTheme);

    return () => {
      clearInterval(id);
      html.setAttribute('data-theme', originalTheme);
      if (originalCTA) html.setAttribute('data-cta', originalCTA);
      else html.removeAttribute('data-cta');
    };
  }, []);

  return (
    <div className="auth-page">
      <Container size="lg" py="xl">
        {/* Mobile brand bar */}
        <MobileTopBar />

        <Grid gutter="xl" align="start">
          {/* Left: Brand + Marketing (desktop/tablet only) */}
          <Grid.Col span={{ base: 12, md: 6, lg: 7 }} visibleFrom="md">
            <Stack gap="md" maw={620}>
              {/* Gradient wordmark + tiny left nudge if PNG has safe area */}
              <BrandLockup className="bp-wordmark auth-hero-lockup" />

              <Title
                order={1}
                className="auth-hero-title"
                style={{
                  lineHeight: 1.05,
                  fontWeight: 800,
                  letterSpacing: -0.2,
                  fontSize: 'clamp(34px, 5vw, 56px)',
                }}
              >
                Secure, global messaging with{' '}
                <span className="text-blue-purple">instant translation</span>
              </Title>

              <Text c="dimmed" size="lg" style={{ maxWidth: 560 }}>
                End-to-end encryption, AI-powered translation, disappearing
                messages, and voice/video calling.
              </Text>

              <List spacing="sm" size="sm" center>
                <List.Item
                  icon={
                    <ThemeIcon
                      variant="filled"
                      radius="xl"
                      style={{
                        background: 'linear-gradient(90deg, #3b82f6, #7c3aed)',
                        color: '#fff',
                      }}
                    >
                      <Lock size={16} />
                    </ThemeIcon>
                  }
                >
                  End-to-end encryption by default
                </List.Item>
                <List.Item
                  icon={
                    <ThemeIcon
                      variant="filled"
                      radius="xl"
                      style={{
                        background: 'linear-gradient(90deg, #3b82f6, #7c3aed)',
                        color: '#fff',
                      }}
                    >
                      <Globe size={16} />
                    </ThemeIcon>
                  }
                >
                  Auto-translate 100+ languages
                </List.Item>
                <List.Item
                  icon={
                    <ThemeIcon
                      variant="filled"
                      radius="xl"
                      style={{
                        background: 'linear-gradient(90deg, #3b82f6, #7c3aed)',
                        color: '#fff',
                      }}
                    >
                      <MessageCircle size={16} />
                    </ThemeIcon>
                  }
                >
                  Disappearing messages & read receipts
                </List.Item>
                <List.Item
                  icon={
                    <ThemeIcon
                      variant="filled"
                      radius="xl"
                      style={{
                        background: 'linear-gradient(90deg, #3b82f6, #7c3aed)',
                        color: '#fff',
                      }}
                    >
                      <ShieldCheck size={16} />
                    </ThemeIcon>
                  }
                >
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
                  Tip: Use the same account on web and mobile. Your messages stay
                  synced.
                </Text>
              </Paper>
            </Stack>
          </Grid.Col>

          {/* Right: Auth form + Get app */}
          <Grid.Col span={{ base: 12, md: 6, lg: 5 }} style={{ alignSelf: 'start' }}>
            <Stack gap="lg" style={{ maxWidth: 440, marginLeft: 'auto' }} className="auth-login">
              <Outlet /> {/* Login / Register / Forgot / Reset (card-only) */}
              <GetAppCard />
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>
    </div>
  );
}

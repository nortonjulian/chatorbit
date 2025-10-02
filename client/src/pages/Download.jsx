import { Container, Stack, Title, Text, Group, Image, Anchor, Paper } from '@mantine/core';

const APP_IOS     = 'https://go.chatforia.com/ios';
const APP_ANDROID = 'https://go.chatforia.com/android';

export default function Download() {
  return (
    <Container size="sm" py="xl">
      <Stack gap="md" align="center">
        <Title order={2}>Get Chatforia</Title>
        <Text c="dimmed" ta="center">
          Install the app on your phone to start chatting securely with instant translation.
        </Text>

        <Group>
          <Anchor href={APP_IOS} target="_blank" rel="noopener noreferrer">
            <Image src="/badges/app-store-badge.svg" h={48} alt="Download on the App Store" />
          </Anchor>
          <Anchor href={APP_ANDROID} target="_blank" rel="noopener noreferrer">
            <Image src="/badges/google-play-badge.png" h={48} alt="Get it on Google Play" />
          </Anchor>
        </Group>

        <Paper p="md" withBorder>
          <Group align="center">
            <Image src="/qr-chatforia.png" h={96} w={96} alt="Scan to download" />
            <Text size="sm" maw={280}>
              Scan this QR with your phone to automatically open the right store.
            </Text>
          </Group>
        </Paper>
      </Stack>
    </Container>
  );
}

import { useMemo, useState } from 'react';
import {
  Paper,
  Title,
  Text,
  Stack,
  Group,
  Card,
  Badge,
  List,
  Grid,
  Anchor,
  Button,
  TextInput,
  Textarea,
  Divider,
  Alert,
} from '@mantine/core';
import { IconMail, IconInfoCircle, IconCheck } from '@tabler/icons-react';
import { PLACEMENTS } from '@/ads/placements';
import axiosClient from '@/api/axiosClient';
import { toast } from '@/utils/toast';

export default function Advertise() {
  const [contact, setContact] = useState({
    name: '',
    email: '',
    company: '',
    budget: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Pull sizes from your declared placements for a quick spec table
  const placementSpecs = useMemo(() => {
    try {
      return Object.entries(PLACEMENTS).map(([key, cfg]) => {
        const sizes = Array.isArray(cfg?.sizes) ? cfg.sizes : [];
        // normalize sizes -> "WxH"
        const pretty = sizes.map((s) => Array.isArray(s) ? `${s[0]}x${s[1]}` : String(s));
        return { id: key, sizes: pretty, adsenseSlot: cfg?.adsenseSlot || null };
      });
    } catch {
      return [];
    }
  }, []);

  const pubId = import.meta.env.VITE_ADSENSE_PUB_ID || null;

  async function submit() {
    if (!contact.name || !contact.email || !contact.message) {
      toast.err('Please fill in name, email, and message.');
      return;
    }
    setSubmitting(true);
    try {
      // Preferred: send to your server (optional to implement)
      await axiosClient.post('/ads/inquiries', contact);
      setSubmitted(true);
      toast.ok('Thanks! We’ll be in touch soon.');
    } catch (e) {
      // Fallback: open a mailto prefilled with the form content
      const body =
        `Name: ${contact.name}\n` +
        `Email: ${contact.email}\n` +
        `Company: ${contact.company}\n` +
        `Budget: ${contact.budget}\n\n` +
        `${contact.message}`;
      const mail = `mailto:ads@chatforia.example?subject=Advertising%20Inquiry&body=${encodeURIComponent(body)}`;
      window.location.href = mail;
      setSubmitted(true);
      toast.info('Opening your email client to send the inquiry…');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Paper withBorder shadow="sm" radius="xl" p="lg" maw={880} mx="auto">
      <Stack gap="md">
        <Title order={2}>Advertise with Chatforia</Title>
        <Text c="dimmed">
          Reach engaged messaging users with tasteful, brand-safe placements.
          We offer banner inventory in high-visibility spots, sponsorships,
          and house promos. Premium subscribers do not see ads.
        </Text>

        {/* Programmatic / AdSense note */}
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          {pubId ? (
            <>
              We currently serve ads via <b>Google AdSense</b>. If you’d like to
              target us through Google Ads, use publisher ID <code>{pubId}</code> and ask
              for managed placement on our units below. Direct sponsorships are available—use the form.
            </>
          ) : (
            <>
              We currently serve ads via <b>Google AdSense</b>. Direct sponsorships are also available—use the form below.
            </>
          )}
        </Alert>

        <Divider label="Inventory & Specs" labelPosition="center" />

        <Grid gutter="md">
          {placementSpecs.length ? placementSpecs.map((p) => (
            <Grid.Col key={p.id} span={{ base: 12, sm: 6 }}>
              <Card withBorder radius="lg" p="md">
                <Group justify="space-between" align="flex-start" mb="xs">
                  <Text fw={600}>{p.id}</Text>
                  <Badge variant="light">Display</Badge>
                </Group>
                <Text size="sm" c="dimmed">Accepted sizes</Text>
                <Group gap="xs" mt={6} wrap="wrap">
                  {p.sizes.length ? p.sizes.map((s) => (
                    <Badge key={s} variant="outline">{s}</Badge>
                  )) : <Text size="sm">—</Text>}
                </Group>
                {p.adsenseSlot && (
                  <Text size="xs" mt="sm" c="dimmed">
                    AdSense slot: <code>{p.adsenseSlot}</code>
                  </Text>
                )}
              </Card>
            </Grid.Col>
          )) : (
            <Grid.Col span={12}>
              <Text c="dimmed">No placements configured yet. Add them in <code>ads/placements.js</code>.</Text>
            </Grid.Col>
          )}
        </Grid>

        <Card withBorder radius="lg" p="md">
          <Title order={4} mb="xs">Why Chatforia?</Title>
          <List
            spacing="xs"
            icon={<IconCheck size={14} />}
            withPadding
            size="sm"
          >
            <List.Item>High session frequency and dwell time in chat UI</List.Item>
            <List.Item>Brand-safe formats; respectful frequency capping</List.Item>
            <List.Item>Sponsored moments (e.g., “Start a Chat” modal) available</List.Item>
            <List.Item>Direct deals or programmatic via AdSense/Google Ads</List.Item>
          </List>
        </Card>

        <Divider label="Contact" labelPosition="center" />

        {submitted ? (
          <Alert color="green" variant="light">
            Thanks! Your inquiry is on its way. We’ll follow up shortly.
          </Alert>
        ) : (
          <Card withBorder radius="lg" p="md">
            <Stack gap="sm">
              <Group grow wrap="wrap">
                <TextInput
                  label="Your name"
                  placeholder="Jane Doe"
                  value={contact.name}
                  onChange={(e) => setContact((c) => ({ ...c, name: e.currentTarget.value }))}
                  required
                />
                <TextInput
                  label="Email"
                  placeholder="you@company.com"
                  value={contact.email}
                  onChange={(e) => setContact((c) => ({ ...c, email: e.currentTarget.value }))}
                  required
                  type="email"
                />
              </Group>
              <Group grow wrap="wrap">
                <TextInput
                  label="Company"
                  placeholder="Acme Inc."
                  value={contact.company}
                  onChange={(e) => setContact((c) => ({ ...c, company: e.currentTarget.value }))}
                />
                <TextInput
                  label="Monthly budget (optional)"
                  placeholder="$5,000"
                  value={contact.budget}
                  onChange={(e) => setContact((c) => ({ ...c, budget: e.currentTarget.value }))}
                />
              </Group>
              <Textarea
                label="Tell us about your campaign"
                placeholder="Targeting, dates, KPIs, placement preferences…"
                minRows={4}
                value={contact.message}
                onChange={(e) => setContact((c) => ({ ...c, message: e.currentTarget.value }))}
                required
              />
              <Group justify="space-between" mt="xs">
                <Anchor href="mailto:ads@chatforia.example">
                  <Group gap={6}>
                    <IconMail size={16} /> ads@chatforia.example
                  </Group>
                </Anchor>
                <Button loading={submitting} onClick={submit}>
                  Send inquiry
                </Button>
              </Group>
            </Stack>
          </Card>
        )}

        <Text size="xs" c="dimmed" ta="center">
          By submitting, you agree to our{' '}
          <Anchor href="/terms" target="_blank">Terms</Anchor> and{' '}
          <Anchor href="/privacy" target="_blank">Privacy Policy</Anchor>.
        </Text>
      </Stack>
    </Paper>
  );
}

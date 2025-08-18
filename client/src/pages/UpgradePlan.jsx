import { useState } from 'react';
import { Card, Title, Text, Button, Group, Stack, Badge } from '@mantine/core';
import axiosClient from '../api/axiosClient';
import { useUser } from '../context/UserContext';

function PlanCard({ title, price, features = [], cta, onClick, highlight = false }) {
  return (
    <Card withBorder radius="xl" shadow={highlight ? 'md' : 'sm'} p="lg">
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Title order={3}>{title}</Title>
          {highlight && <Badge color="yellow">Popular</Badge>}
        </Group>
        <Title order={2}>{price}</Title>
        <Stack gap={4}>
          {features.map((f) => (
            <Text key={f} size="sm">• {f}</Text>
          ))}
        </Stack>
        <Button mt="sm" onClick={onClick}>{cta}</Button>
      </Stack>
    </Card>
  );
}

export default function UpgradePage() {
  const { currentUser } = useUser();
  const [loading, setLoading] = useState(false);

  const startCheckout = async (plan = 'PREMIUM_MONTHLY') => {
    try {
      setLoading(true);
      const { data } = await axiosClient.post('/billing/checkout', {
        plan, // map to priceId server-side if supporting multiple plans
      });
      const url = data?.checkoutUrl || data?.url; // support either shape
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (e) {
      console.error('Checkout error', e);
      alert('Could not start checkout. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const isPremium = (currentUser?.plan || '').toUpperCase() !== 'FREE';

  return (
    <Stack gap="lg" maw={900} mx="auto" p="md">
      <Title order={2}>Upgrade</Title>
      <Text c="dimmed">
        Unlock premium features like advanced AI, custom ringtones, backups, and more.
      </Text>

      <Group grow align="stretch">
        <PlanCard
          title="Free"
          price="$0"
          features={[
            '1:1 and group messaging',
            'Basic AI replies',
            'Standard attachments',
          ]}
          cta="Current Plan"
          onClick={() => {}}
        />

        <PlanCard
          title="Premium"
          price="$9.99 / mo"
          features={[
            'All Free features',
            'Custom ringtones & message tones',
            'AI power features',
            'Priority updates',
            'Backups & device syncing',
          ]}
          highlight
          cta={isPremium ? 'You’re Premium' : (loading ? 'Redirecting…' : 'Upgrade')}
          onClick={() => !isPremium && startCheckout('PREMIUM_MONTHLY')}
        />
      </Group>
    </Stack>
  );
}

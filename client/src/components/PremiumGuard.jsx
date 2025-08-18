import { useUser } from '../context/UserContext';
import { Card, Text, Button, Stack } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

/**
 * Wraps children and only renders them if the user is premium.
 * Otherwise, shows an "Upgrade" notice.
 *
 * Usage:
 * <PremiumGuard>
 *   <Button>Premium Action</Button>
 * </PremiumGuard>
 */
export default function PremiumGuard({ children }) {
  const { currentUser } = useUser();
  const navigate = useNavigate();

  const isPremium =
    currentUser?.role === 'ADMIN' ||
    ['PREMIUM', 'PRO', 'PLUS'].includes(currentUser?.plan?.toUpperCase?.() || '');

  if (isPremium) {
    return children;
  }

  return (
    <Card withBorder radius="md" p="md" shadow="sm">
      <Stack gap="xs" align="center">
        <Text size="sm" c="dimmed">
          This feature requires a Premium plan.
        </Text>
        <Button
          color="yellow"
          onClick={() => navigate('/settings/upgrade')}
        >
          Upgrade Now
        </Button>
      </Stack>
    </Card>
  );
}

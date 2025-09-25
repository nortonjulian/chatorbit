import { useState } from 'react';
import { Switch, Group, Text } from '@mantine/core';
import axios from '../api/axiosClient';
import { useUser } from '../context/UserContext';
// import { toast } from '../utils/toast';

export default function PrivacySection() {
  const { currentUser, setCurrentUser } = useUser();
  const [saving, setSaving] = useState(false);

  const onToggle = async (v) => {
    try {
      setSaving(true);
      const { data } = await axios.patch('/users/me', { strictE2EE: v });
      setCurrentUser(data);
      toast.ok(v
        ? 'Strict E2EE enabled. AI/Translate will be disabled.'
        : 'Strict E2EE disabled. AI/Translate re-enabled.');
    } catch (e) {
      toast.err('Could not update privacy setting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Group justify="space-between" mt="md" align="flex-start">
      <div>
        <Text fw={600}>Strict end-to-end encryption</Text>
        <Text c="dimmed" size="sm">
          Store only ciphertext on the server. Disables AI/Translate and moderation previews.
        </Text>
      </div>
    </Group>
  );
}

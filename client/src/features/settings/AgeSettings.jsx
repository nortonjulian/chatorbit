import { useEffect, useMemo, useState } from 'react';
import { Card, Stack, Group, Select, MultiSelect, Switch, Button, Text, Alert } from '@mantine/core';
import axiosClient from '@/api/axiosClient';
import { useUser } from '@/context/UserContext';

const AGE_BANDS = [
  { value: 'TEEN_13_17', label: '13–17 (Teen)' },
  { value: 'ADULT_18_24', label: '18–24' },
  { value: 'ADULT_25_34', label: '25–34' },
  { value: 'ADULT_35_49', label: '35–49' },
  { value: 'ADULT_50_PLUS', label: '50+' },
];

export default function AgeSettings() {
  const { currentUser, setCurrentUser } = useUser();
  const [ageBand, setAgeBand] = useState(currentUser?.ageBand || null);
  const [wantsAgeFilter, setWantsAgeFilter] = useState(currentUser?.wantsAgeFilter !== false);
  const [allowed, setAllowed] = useState(
    Array.isArray(currentUser?.randomChatAllowedBands) ? currentUser.randomChatAllowedBands : []
  );
  const isTeen = ageBand === 'TEEN_13_17';

  const adultBands = useMemo(
    () => AGE_BANDS.filter(b => b.value !== 'TEEN_13_17'),
    []
  );

  useEffect(() => {
    // keep UI safe: teens locked to teen only
    if (isTeen) {
      setAllowed(['TEEN_13_17']);
      setWantsAgeFilter(true);
    } else {
      // strip teen from allowed if present
      setAllowed(prev => (prev || []).filter(v => v !== 'TEEN_13_17'));
    }
  }, [isTeen]);

  const save = async () => {
    const payload = {
      ageBand,
      wantsAgeFilter,
      randomChatAllowedBands: allowed,
    };
    const { data } = await axiosClient.patch('/users/me', payload);
    // refresh local user
    setCurrentUser({ ...currentUser, ...data, ageBand, wantsAgeFilter, randomChatAllowedBands: allowed });
  };

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="sm">
        <Text fw={600}>Age & Random Chat</Text>

        <Select
          label="My age band"
          placeholder="Select your band"
          data={AGE_BANDS}
          value={ageBand}
          onChange={setAgeBand}
          searchable
          nothingFoundMessage="Pick one"
        />

        {isTeen && (
          <Alert color="blue" variant="light">
            For safety, teens can only match with teens in Random Chat.
          </Alert>
        )}

        <Switch
          label="Only match with the age bands I choose"
          checked={wantsAgeFilter}
          onChange={(e) => setWantsAgeFilter(e.currentTarget.checked)}
          disabled={isTeen} // teens always filtered
        />

        <MultiSelect
          label="Match me with (adults only)"
          data={adultBands}
          disabled={isTeen || !wantsAgeFilter}
          value={allowed}
          onChange={setAllowed}
          searchable
          placeholder="Choose one or more"
        />

        <Group justify="flex-end" mt="xs">
          <Button onClick={save}>Save</Button>
        </Group>

        <Text size="xs" c="dimmed">
          We don’t show your age publicly. These settings only guide Random Chat pairing. Adults can’t match with teens.
        </Text>
      </Stack>
    </Card>
  );
}

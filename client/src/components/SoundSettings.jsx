import { useMemo, useState } from 'react';
import { Group, Select, Slider, Button, Stack, Text, Alert, Anchor } from '@mantine/core';
import { useUser } from '../context/UserContext';
import { playSound } from '../lib/sound';
import {
  listMessageTones,
  listRingtones,
  messageToneUrl,
  ringtoneUrl,
  getMessageTone,
  setMessageTone,
  getRingtone,
  setRingtone,
  getVolume,
  setVolume,
} from '../lib/soundPrefs';
import PremiumGuard from './PremiumGuard';

export default function SoundSettings() {
  const { currentUser } = useUser();
  const plan = (currentUser?.plan || 'FREE').toUpperCase();

  const [messageTone, setMsg] = useState(getMessageTone());
  const [ringtone, setRing] = useState(getRingtone());
  const [volume, setVol] = useState(getVolume());

  const messageOptions = useMemo(() => listMessageTones(plan), [plan]);
  const ringOptions = useMemo(() => listRingtones(plan), [plan]);

  const save = () => {
    setMessageTone(messageTone);
    setRingtone(ringtone);
    setVolume(volume);
  };

  const isFree = plan !== 'PREMIUM';

  return (
    <Stack gap="sm">
      <Text fw={600}>Notification Sounds</Text>

      {isFree && (
        <>
          <Alert variant="light" color="blue">
            You’re on Free—only 3 tones available.{' '}
            <Anchor href="/settings/upgrade">Upgrade</Anchor> to unlock all.
          </Alert>
          <PremiumGuard variant="inline">
            <Text size="sm">Unlock all tones and ringtones.</Text>
          </PremiumGuard>
        </>
      )}

      <Group grow>
        <Select
          label="Message tone"
          data={messageOptions}
          value={messageTone}
          onChange={(v) => v && setMsg(v)}
          searchable
          nothingFoundMessage="Add files in /public/sounds/Message_Tones"
        />
        <Button
          variant="light"
          onClick={() => playSound(messageToneUrl(messageTone), { volume })}
        >
          Preview
        </Button>
      </Group>

      <Group grow>
        <Select
          label="Ringtone"
          data={ringOptions}
          value={ringtone}
          onChange={(v) => v && setRing(v)}
          searchable
          nothingFoundMessage="Add files in /public/sounds/Ringtones"
        />
        <Button
          variant="light"
          onClick={() => {
            const el = playSound(ringtoneUrl(ringtone), { volume, loop: false });
            setTimeout(() => {
              try { el.pause(); } catch {}
            }, 3000);
          }}
        >
          Preview
        </Button>
      </Group>

      <div>
        <Text size="sm" mb={6}>
          Volume
        </Text>
        <Slider min={0} max={1} step={0.05} value={volume} onChange={setVol} />
      </div>

      <Group justify="flex-end">
        <Button onClick={save}>Save</Button>
      </Group>

      <Text size="xs" c="dimmed">
        Add or remove files in <code>client/public/sounds/Message_Tones</code> and{' '}
        <code>client/public/sounds/Ringtones</code>. Update the lists in{' '}
        <code>soundPrefs.js</code> to reflect new filenames.
      </Text>
    </Stack>
  );
}

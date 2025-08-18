import { useMemo, useState } from 'react';
import { Group, Select, Slider, Button, Stack, Text } from '@mantine/core';
import {
  MESSAGE_TONES,
  RINGTONES,
  getMessageTone,
  getRingtone,
  setMessageTone,
  setRingtone,
  getVolume,
  setVolume,
  messageToneUrl,
  ringtoneUrl,
} from '../lib/soundPrefs';
import { playSound } from '../lib/sound';

export default function SoundSettings() {
  const [messageTone, setMessageToneState] = useState(getMessageTone());
  const [ringtone, setRingtoneState] = useState(getRingtone());
  const [volume, setVolumeState] = useState(getVolume());

  const messageOptions = useMemo(() => MESSAGE_TONES, []);
  const ringOptions = useMemo(() => RINGTONES, []);

  const save = () => {
    setMessageTone(messageTone);
    setRingtone(ringtone);
    setVolume(volume);
  };

  return (
    <Stack gap="sm">
      <Text fw={600}>Notification Sounds</Text>

      <Group grow>
        <Select
          label="Message tone"
          data={messageOptions}
          value={messageTone}
          onChange={(v) => v && setMessageToneState(v)}
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
          onChange={(v) => v && setRingtoneState(v)}
          searchable
          nothingFoundMessage="Add files in /public/sounds/Ringtones"
        />
        <Button
          variant="light"
          onClick={() => {
            const el = playSound(ringtoneUrl(ringtone), { volume, loop: false });
            setTimeout(() => {
              try {
                el.pause();
              } catch {}
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
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={setVolumeState}
          marks={[{ value: 0 }, { value: 0.5 }, { value: 1 }]}
        />
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

import { useEffect, useMemo, useState } from 'react';
import { Group, Select, Slider, Button, Stack, Text, Alert, Anchor } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { playSound } from '@/lib/sound';
import { messageToneUrl, ringtoneUrl, getVolume, setVolume } from '@/lib/soundPrefs';
import PremiumGuard from '@/components/PremiumGuard';
import { fetchTones, updateTones } from '@/features/settings/api/tones';

export default function SoundSettings() {
  const { currentUser } = useUser();
  const navigate = useNavigate();

  const isPremium = String(currentUser?.plan || 'FREE').toUpperCase() === 'PREMIUM';

  const [messageTone, setMsg] = useState('');
  const [ringtone, setRing] = useState('');
  const [volume, setVol] = useState(getVolume());
  const [loading, setLoading] = useState(true);

  // Fetch catalogs + current selections from server
  const [catalog, setCatalog] = useState({ messageTone: [], ringtone: [] });
  const [canUsePremium, setCanUsePremium] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await fetchTones();
        if (ignore) return;
        setCanUsePremium(!!data?.canUsePremium);

        setCatalog({
          ringtone: [
            {
              group: 'Free',
              items: (data?.catalog?.ringtone || [])
                .filter((x) => !x.premium)
                .map((x) => ({ label: x.id, value: x.id })),
            },
            {
              group: 'Premium',
              items: (data?.catalog?.ringtone || [])
                .filter((x) => x.premium)
                .map((x) => ({
                  label: `⭐ ${x.id}`,
                  value: x.id,
                  disabled: !data?.canUsePremium,
                })),
            },
          ],
          messageTone: [
            {
              group: 'Free',
              items: (data?.catalog?.messageTone || [])
                .filter((x) => !x.premium)
                .map((x) => ({ label: x.id, value: x.id })),
            },
            {
              group: 'Premium',
              items: (data?.catalog?.messageTone || [])
                .filter((x) => x.premium)
                .map((x) => ({
                  label: `⭐ ${x.id}`,
                  value: x.id,
                  disabled: !data?.canUsePremium,
                })),
            },
          ],
        });

        setMsg(data?.current?.messageTone || 'ping.mp3');
        setRing(data?.current?.ringtone || 'classic.mp3');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const isFree = !isPremium;

  const messageOptions = useMemo(() => catalog.messageTone, [catalog]);
  const ringOptions = useMemo(() => catalog.ringtone, [catalog]);

  async function save() {
    try {
      await updateTones({ ringtone, messageTone });
      // volume stays client-side
      setVolume(volume);
      alert('Saved!');
    } catch (e) {
      const status = e?.response?.status;
      if (status === 402 || e?.response?.data?.code === 'PREMIUM_REQUIRED') {
        navigate('/settings/upgrade');
      } else {
        alert('Could not save tones.');
      }
    }
  }

  return (
    <Stack gap="sm">
      <Text fw={600}>Notification Sounds</Text>

      {isFree && (
        <>
          <Alert variant="light" color="blue">
            You’re on Free — premium tones are locked. <Anchor href="/settings/upgrade">Upgrade</Anchor> to unlock all.
          </Alert>
          <PremiumGuard variant="inline">
            <Text size="sm">Unlock all tones and ringtones.</Text>
          </PremiumGuard>
        </>
      )}

      {/* Message tone */}
      <Group grow>
        <Select
          label="Message tone"
          data={messageOptions}
          value={messageTone}
          onChange={(v) => {
            if (!v) return;
            const isPrem = (catalog.messageTone[1]?.items || []).some((i) => i.value === v);
            if (isPrem && !canUsePremium) return navigate('/settings/upgrade');
            setMsg(v);
          }}
          searchable
          disabled={loading}
          nothingFoundMessage="Add files in /public/sounds/Message_Tones"
        />
        <Button variant="light" onClick={() => playSound(messageToneUrl(messageTone), { volume })} disabled={!messageTone}>
          Preview
        </Button>
      </Group>

      {/* Ringtone */}
      <Group grow>
        <Select
          label="Ringtone"
          data={ringOptions}
          value={ringtone}
          onChange={(v) => {
            if (!v) return;
            const isPrem = (catalog.ringtone[1]?.items || []).some((i) => i.value === v);
            if (isPrem && !canUsePremium) return navigate('/settings/upgrade');
            setRing(v);
          }}
          searchable
          disabled={loading}
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
          disabled={!ringtone}
        >
          Preview
        </Button>
      </Group>

      {/* Volume */}
      <div>
        <Text size="sm" mb={6}>
          Volume
        </Text>
        <Slider min={0} max={1} step={0.05} value={volume} onChange={setVol} />
      </div>

      <Group justify="flex-end">
        <Button onClick={save} disabled={loading}>
          Save
        </Button>
      </Group>

      <Text size="xs" c="dimmed">
        Files live in <code>client/public/sounds/Message_Tones</code> and <code>client/public/sounds/Ringtones</code>.
      </Text>
    </Stack>
  );
}

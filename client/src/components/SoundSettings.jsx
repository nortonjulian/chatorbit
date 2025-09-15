import { useEffect, useMemo, useState } from 'react';
import { Group, Select, Slider, Button, Stack, Text, Alert, Anchor } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { playSound } from '@/lib/sound';
import { messageToneUrl, ringtoneUrl, getVolume, setVolume } from '@/lib/soundPrefs';
import PremiumGuard from '@/components/PremiumGuard';
import { fetchTones, updateTones } from '@/features/settings/api/tones';

// Turn any unknown id into a stable string
function idToString(x, idx) {
  if (x == null) return `item_${idx}`;
  const t = typeof x;
  if (t === 'string' || t === 'number' || t === 'boolean') return String(x);
  if (t === 'object') {
    const cand = x.id ?? x.name ?? x.filename ?? x.url ?? x.path ?? x.slug;
    if (cand != null) return String(cand);
    try {
      // short hash-like fallback, safe for labels/values
      const raw = JSON.stringify(x);
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = (hash * 31 + raw.charCodeAt(i)) | 0;
      }
      return `obj_${Math.abs(hash)}_${idx}`;
    } catch {
      return `obj_${idx}`;
    }
  }
  return String(x);
}

// Build grouped data safely and dedupe by `value`
function buildGrouped(list, canUsePremium) {
  const seen = new Set();
  const free = [];
  const prem = [];

  (list || []).forEach((item, idx) => {
    const value = idToString(item?.id ?? item?.value ?? item, idx);
    if (seen.has(value)) return; // skip duplicates that would crash Mantine
    seen.add(value);

    const label = item?.label != null ? String(item.label) : value;
    const row = {
      value,
      label: item?.premium ? `⭐ ${label}` : label,
      disabled: !!item?.premium && !canUsePremium,
    };

    if (item?.premium) prem.push(row);
    else free.push(row);
  });

  return [
    { group: 'Free', items: free },
    { group: 'Premium', items: prem },
  ];
}

// Ensure controlled value is valid (or null)
function ensureSelected(validGroups, desired) {
  const flat = validGroups.flatMap((g) => g.items);
  if (desired && flat.some((o) => o.value === desired)) return desired;
  return flat[0]?.value ?? null;
}

export default function SoundSettings() {
  const { currentUser } = useUser();
  const navigate = useNavigate();
  const isPremium = String(currentUser?.plan || 'FREE').toUpperCase() === 'PREMIUM';

  const [messageTone, setMsg] = useState(''); // string
  const [ringtone, setRing] = useState('');   // string
  const [volume, setVol] = useState(getVolume());
  const [loading, setLoading] = useState(true);

  const [messageGroups, setMessageGroups] = useState([{ group: 'Free', items: [] }]);
  const [ringGroups, setRingGroups] = useState([{ group: 'Free', items: [] }]);
  const [canUsePremium, setCanUsePremium] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await fetchTones();
        if (ignore) return;
        const canPrem = !!data?.canUsePremium;
        setCanUsePremium(canPrem);

        const msg = buildGrouped(data?.catalog?.messageTone || [], canPrem);
        const ring = buildGrouped(data?.catalog?.ringtone || [], canPrem);
        setMessageGroups(msg);
        setRingGroups(ring);

        const wantedMsg = idToString(data?.current?.messageTone ?? 'ping.mp3', 0);
        const wantedRing = idToString(data?.current?.ringtone ?? 'classic.mp3', 0);

        setMsg(ensureSelected(msg, wantedMsg) || '');
        setRing(ensureSelected(ring, wantedRing) || '');
      } catch {
        // Safe fallback
        const msg = buildGrouped([{ id: 'ping.mp3' }], false);
        const ring = buildGrouped([{ id: 'classic.mp3' }], false);
        setMessageGroups(msg);
        setRingGroups(ring);
        setMsg('ping.mp3');
        setRing('classic.mp3');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const messageOptions = useMemo(() => messageGroups, [messageGroups]);
  const ringOptions = useMemo(() => ringGroups, [ringGroups]);

  async function save() {
    try {
      await updateTones({ ringtone, messageTone });
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

      {!isPremium && (
        <>
          <Alert variant="light" color="blue">
            You’re on Free — premium tones are locked.{' '}
            <Anchor href="/settings/upgrade">Upgrade</Anchor> to unlock all.
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
          value={messageTone || null}
          onChange={(v) => {
            if (!v) return;
            const premItems = (messageOptions[1]?.items || []);
            const isPrem = premItems.some((i) => i.value === v);
            if (isPrem && !canUsePremium) return navigate('/settings/upgrade');
            setMsg(v);
          }}
          searchable
          disabled={loading}
          nothingFoundMessage="Add files in /public/sounds/Message_Tones"
        />
        <Button
          variant="light"
          onClick={() => messageTone && playSound(messageToneUrl(messageTone), { volume })}
          disabled={!messageTone}
        >
          Preview
        </Button>
      </Group>

      {/* Ringtone */}
      <Group grow>
        <Select
          label="Ringtone"
          data={ringOptions}
          value={ringtone || null}
          onChange={(v) => {
            if (!v) return;
            const premItems = (ringOptions[1]?.items || []);
            const isPrem = premItems.some((i) => i.value === v);
            if (isPrem && !canUsePremium) return navigate('/settings/upgrade');
            setRing(v);
          }}
          searchable
          disabled={loading}
          nothingFoundMessage="Add files in /public/sounds/Ringtones"
        />
        <Button
          variant="light"
          onClick={() => ringtone && playSound(ringtoneUrl(ringtone), { volume, loop: false })}
          disabled={!ringtone}
        >
          Preview
        </Button>
      </Group>

      {/* Volume */}
      <div>
        <Text size="sm" mb={6}>Volume</Text>
        <Slider min={0} max={1} step={0.05} value={volume} onChange={setVol} />
      </div>

      <Group justify="flex-end">
        <Button onClick={save} disabled={loading}>Save</Button>
      </Group>

      <Text size="xs" c="dimmed">
        Files live in <code>client/public/sounds/Message_Tones</code> and <code>client/public/sounds/Ringtones</code>.
      </Text>
    </Stack>
  );
}

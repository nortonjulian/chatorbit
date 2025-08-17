import React, { useState } from 'react';
import {
  Button,
  Card,
  Group,
  Stack,
  Text,
  Textarea,
  TextInput,
  PasswordInput,
} from '@mantine/core';
import {
  deriveSharedKeyBrowser,
  openWithKey,
} from '../utils/cryptoProvisionClient.js';
import { installLocalPrivateKeyBundle } from '../utils/encryptionClient.js';

export default function LinkOnNewDevice() {
  const [qrJson, setQrJson] = useState('');
  const [deviceName, setDeviceName] = useState('This device');
  const [platform, setPlatform] = useState(detectPlatform());
  const [status, setStatus] = useState('Paste QR payload to begin');
  const [passcode, setPasscode] = useState('');

  function detectPlatform() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Android/i.test(ua)) return 'Android';
    if (/Mac/i.test(ua)) return 'macOS';
    if (/Win/i.test(ua)) return 'Windows';
    return 'Web';
  }

  const begin = async () => {
    try {
      const payload = JSON.parse(qrJson);
      setStatus('Contacting server…');

      const res = await fetch('/devices/provision/client-init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          linkId: payload.linkId,
          secret: payload.secret,
          ePub: 'unused-b64', // placeholder in this simplified HKDF scheme
          deviceName,
          platform,
        }),
      });
      const data = await res.json();

      setStatus(`SAS: ${data.sasCode}. Awaiting approval…`);

      const poll = async () => {
        const p = await fetch(
          `/devices/provision/poll?linkId=${encodeURIComponent(payload.linkId)}`
        );
        const json = await p.json();
        if (!json.ready) {
          return setTimeout(poll, 1500);
        }

        // Derive shared key and decrypt received bundle
        const k = await deriveSharedKeyBrowser(payload.secret, json.sPub, '');
        const bundle = openWithKey(k, json.nonce, json.ciphertext);

        // Save keys encrypted-at-rest using user's passcode
        if (!passcode || passcode.length < 6) {
          throw new Error('Choose a passcode (min 6 chars)');
        }
        await installLocalPrivateKeyBundle(bundle, passcode);

        // Register this device on the backend
        await fetch('/devices/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
          body: JSON.stringify({
            linkId: payload.linkId,
            publicKey: bundle.publicKey,
            deviceName,
            platform,
          }),
        });

        setStatus('Linked ✓ You can close this page.');
      };

      setTimeout(poll, 1500);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  };

  return (
    <Card withBorder p="lg" radius="md" maw={700} mx="auto">
      <Stack gap="md">
        <Text fw={700} size="lg">
          Link to an existing account
        </Text>
        <TextInput
          label="Device name"
          value={deviceName}
          onChange={(e) => setDeviceName(e.currentTarget.value)}
          maxLength={64}
        />
        <TextInput
          label="Platform"
          value={platform}
          onChange={(e) => setPlatform(e.currentTarget.value)}
        />
        <Textarea
          label="QR payload (JSON)"
          autosize
          minRows={4}
          value={qrJson}
          onChange={(e) => setQrJson(e.currentTarget.value)}
          placeholder='{"type":"chatorbit-provision","host":"…","linkId":"…","secret":"…","sas":"123-456"}'
        />
        <PasswordInput
          label="Set a passcode for this device"
          description="Minimum 6 characters"
          value={passcode}
          onChange={(e) => setPasscode(e.currentTarget.value)}
          placeholder="Choose a passcode to protect keys"
        />
        <Group justify="flex-end">
          <Button onClick={begin} disabled={!passcode || passcode.length < 6}>
            Begin Linking
          </Button>
        </Group>
        <Text>{status}</Text>
      </Stack>
    </Card>
  );
}

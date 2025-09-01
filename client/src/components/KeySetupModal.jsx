import { useRef, useState } from 'react';
import {
  Modal,
  Stack,
  Text,
  Group,
  Button,
  FileInput,
  PasswordInput,
  Alert,
} from '@mantine/core';
import axiosClient from '../api/axiosClient';
import { generateKeypair, saveKeysLocal } from '../utils/keys';
import { importEncryptedPrivateKey } from '../utils/keyBackup';

export default function KeySetupModal({ opened, onClose, haveServerPubKey }) {
  const fileRef = useRef(null);
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const finish = () => {
    setPwd('');
    setMsg('');
    setErr('');
    if (fileRef.current) fileRef.current.value = null;
    onClose?.();
  };

  const handleImport = async (file) => {
    try {
      setErr('');
      setMsg('');
      setBusy(true);
      if (!file || !pwd) {
        setErr('Choose a file and enter the password.');
        return;
      }

      const privateKeyB64 = await importEncryptedPrivateKey(file, pwd);
      // We keep the existing publicKey locally (if any); private key unlocks old messages
      saveKeysLocal({ privateKey: privateKeyB64 });

      setMsg(
        'Private key imported to this device. You can read old messages now.'
      );
      setTimeout(finish, 800);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setErr('Import failed. Wrong password or file is invalid.');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setErr('');
      setMsg('');
      setBusy(true);
      const kp = generateKeypair();
      saveKeysLocal(kp);
      // publish public key (server never sees the private)
      await axiosClient.post('/users/keys', { publicKey: kp.publicKey });
      setMsg(
        'New keypair generated. You can read new messages on this device.'
      );
      setTimeout(finish, 800);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setErr('Failed to generate/upload keys.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={finish}
      title="Set up your device keys"
      radius="lg"
      centered
    >
      <Stack gap="sm">
        <Text size="sm">
          This device doesn’t have your private key yet. Import a
          password-protected backup, or generate a new keypair (you’ll be able
          to read new messages from now on).
        </Text>

        {haveServerPubKey ? (
          <Alert variant="light">
            We found a public key on your account. To read past messages on this
            device, import your backup.
          </Alert>
        ) : (
          <Alert variant="light" color="blue">
            New account detected—generating a keypair is recommended.
          </Alert>
        )}

        <Group gap="sm" align="flex-end">
          <FileInput
            ref={fileRef}
            accept="application/json"
            placeholder="Select backup file"
          />
          {/* Add a visible label so tests can query by label text */}
          <PasswordInput
            label="Backup password"
            placeholder="Backup password"
            value={pwd}
            onChange={(e) => setPwd(e.currentTarget.value)}
          />
          <Button
            loading={busy}
            onClick={() => handleImport(fileRef.current?.files?.[0])}
          >
            Import
          </Button>
        </Group>

        <Group justify="space-between" mt="xs">
          <Button
            variant="light"
            color="orange"
            loading={busy}
            onClick={handleGenerate}
          >
            Generate new keypair
          </Button>
          <Button variant="subtle" onClick={finish}>
            Not now
          </Button>
        </Group>

        {msg && (
          <Alert color="green" variant="light">
            {msg}
          </Alert>
        )}
        {err && (
          <Alert color="red" variant="light">
            {err}
          </Alert>
        )}
      </Stack>
    </Modal>
  );
}

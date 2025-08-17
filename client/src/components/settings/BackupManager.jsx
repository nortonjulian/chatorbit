import React, { useState } from 'react';
import {
  Button,
  Card,
  FileInput,
  Group,
  Stack,
  Text,
  PasswordInput,
  Divider,
  Tooltip,
} from '@mantine/core';
import { createEncryptedKeyBackup, restoreEncryptedKeyBackup } from '../../utils/backupClient.js';

export default function BackupManager() {
  // Export state
  const [unlockPasscode, setUnlockPasscode] = useState('');
  const [backupPassword, setBackupPassword] = useState('');
  const [busyExport, setBusyExport] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  // Import state
  const [importPassword, setImportPassword] = useState('');
  const [newLocalPasscode, setNewLocalPasscode] = useState('');
  const [file, setFile] = useState(null);
  const [busyImport, setBusyImport] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  const onExport = async () => {
    setBusyExport(true);
    setExportMsg('');
    try {
      const { blob, filename } = await createEncryptedKeyBackup({ unlockPasscode, backupPassword });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportMsg('Backup created and downloaded ✓');
    } catch (e) {
      setExportMsg(`Error: ${e.message}`);
    } finally {
      setBusyExport(false);
    }
  };

  const onImport = async () => {
    setBusyImport(true);
    setImportMsg('');
    try {
      await restoreEncryptedKeyBackup({
        file,
        backupPassword: importPassword,
        setLocalPasscode: newLocalPasscode,
      });
      setImportMsg('Backup restored ✓ Keys installed and protected locally');
    } catch (e) {
      setImportMsg(`Error: ${e.message}`);
    } finally {
      setBusyImport(false);
    }
  };

  const exportDisabled =
    !unlockPasscode || unlockPasscode.length < 6 || !backupPassword || backupPassword.length < 6;
  const importDisabled =
    !file ||
    !importPassword ||
    importPassword.length < 6 ||
    !newLocalPasscode ||
    newLocalPasscode.length < 6;

  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="md">
        <Text fw={700}>Encrypted Backups</Text>
        <Text c="dimmed">
          Export your key bundle encrypted with a password only you know. Restore on a new device
          without server assistance.
        </Text>

        <Divider label="Create backup" />
        <PasswordInput
          label="Unlock passcode (current device)"
          value={unlockPasscode}
          onChange={(e) => setUnlockPasscode(e.currentTarget.value)}
          description="Used to decrypt your keys locally before exporting"
        />
        <PasswordInput
          label="Backup password"
          value={backupPassword}
          onChange={(e) => setBackupPassword(e.currentTarget.value)}
          description="Used to encrypt the backup file"
        />
        <Group justify="flex-end">
          <Button onClick={onExport} loading={busyExport} disabled={exportDisabled}>
            Download encrypted backup
          </Button>
        </Group>
        {exportMsg && <Text c={exportMsg.startsWith('Error') ? 'red' : 'green'}>{exportMsg}</Text>}

        <Divider label="Restore backup" />
        <FileInput
          label="Backup file (.json)"
          value={file}
          onChange={setFile}
          placeholder="Select backup file"
          accept="application/json"
        />
        <PasswordInput
          label="Backup password"
          value={importPassword}
          onChange={(e) => setImportPassword(e.currentTarget.value)}
        />
        <PasswordInput
          label="New local passcode"
          value={newLocalPasscode}
          onChange={(e) => setNewLocalPasscode(e.currentTarget.value)}
          description="Protect keys at rest on this device"
        />
        <Group justify="flex-end">
          <Button onClick={onImport} loading={busyImport} disabled={importDisabled}>
            Restore backup
          </Button>
        </Group>
        {importMsg && <Text c={importMsg.startsWith('Error') ? 'red' : 'green'}>{importMsg}</Text>}
      </Stack>
    </Card>
  );
}

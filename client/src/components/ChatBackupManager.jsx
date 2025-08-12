// src/components/ChatBackupManager.jsx
import React, { useState } from 'react';
import { Button, Card, Group, PasswordInput, Stack, Text } from '@mantine/core';
import { createEncryptedChatBackup, restoreEncryptedChatBackup } from '../utils/chatBackupClient.js';
import { unlockKeyBundle } from '../utils/encryptionClient.js';

/**
 * Props:
 * - fetchAllMessages: () => Promise<Message[]>  // encrypted messages from backend
 * - currentUserId: number                       // used by your decrypt pipeline if needed
 * - senderPublicKeys?: Record<senderId, base64PublicKey> // optional (your decrypt pipeline may use it)
 *
 * Notes:
 * - This component unlocks the key itself (asks for passcode).
 * - It expects your fetchAllMessages() to return the same encrypted message shape
 *   you’ve been using elsewhere (the one your decrypt pipeline consumes).
 * - We keep the UI minimal; you can style to taste.
 */
export default function ChatBackupManager({
  fetchAllMessages,
  currentUserId,
  senderPublicKeys = {},
}) {
  const [unlockPass, setUnlockPass] = useState('');
  const [backupPassword, setBackupPassword] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');

  const onExport = async () => {
    setStatus('Preparing…');
    try {
      // 1) Unlock local key bundle (decrypt-at-rest)
      if (!unlockPass || unlockPass.length < 6) throw new Error('Enter your unlock passcode (min 6 chars)');
      const { privateKey } = await unlockKeyBundle(unlockPass);

      // 2) Fetch ALL messages the user can see (encrypted)
      const encryptedMessages = await fetchAllMessages();

      // 3) Decrypt for export, using your existing decrypt pipeline
      // Reuse your decryptFetchedMessages() from encryptionClient.js if you want:
      const { decryptFetchedMessages } = await import('../utils/encryptionClient.js');
      const decrypted = await decryptFetchedMessages(
        encryptedMessages,
        privateKey,
        senderPublicKeys,
        currentUserId
      );

      // 4) Normalize to a light export shape
      const normalized = decrypted.map((m) => ({
        id: m.id,
        chatId: m.chatRoomId || m.chatId,
        senderId: m.sender?.id,
        createdAt: m.createdAt,
        text: m.decryptedContent || '',
      }));

      // 5) Build encrypted backup
      if (!backupPassword || backupPassword.length < 6) {
        throw new Error('Backup password must be at least 6 characters');
      }
      const { blob, filename } = await createEncryptedChatBackup({
        decryptedMessages: normalized,
        backupPassword,
        label: 'all-chats',
      });

      // 6) Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setStatus('Backup downloaded ✓');
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const onImport = async () => {
    setStatus('Restoring…');
    try {
      if (!file) throw new Error('Choose a backup file first');
      if (!restorePassword || restorePassword.length < 6) {
        throw new Error('Backup password must be at least 6 characters');
      }
      await restoreEncryptedChatBackup({ file, backupPassword: restorePassword });
      setStatus('Archive restored locally ✓ (read-only)');
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  };

  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap="md">
        <Text fw={700}>Chat Backups (encrypted)</Text>
        <Text c="dimmed">
          Export your decrypted messages into an encrypted file (password-protected).
          Restore loads an archive locally for read-only viewing.
        </Text>

        {/* Export section */}
        <PasswordInput
          label="Unlock passcode (to decrypt keys)"
          value={unlockPass}
          onChange={(e) => setUnlockPass(e.currentTarget.value)}
          description="Your device passcode (min 6 chars)"
        />
        <PasswordInput
          label="Backup password (for the export file)"
          value={backupPassword}
          onChange={(e) => setBackupPassword(e.currentTarget.value)}
          description="This will encrypt the downloaded file (min 6 chars)"
        />
        <Group justify="flex-end">
          <Button
            onClick={onExport}
            disabled={
              !unlockPass || unlockPass.length < 6 ||
              !backupPassword || backupPassword.length < 6
            }
          >
            Download chat backup
          </Button>
        </Group>

        {/* Import section */}
        <input
          type="file"
          accept="application/json"
          onChange={(e) => setFile(e.currentTarget.files?.[0] || null)}
        />
        <PasswordInput
          label="Backup password (to restore)"
          value={restorePassword}
          onChange={(e) => setRestorePassword(e.currentTarget.value)}
          description="The password you used when exporting"
        />
        <Group justify="flex-end">
          <Button
            onClick={onImport}
            disabled={!file || !restorePassword || restorePassword.length < 6}
          >
            Restore backup
          </Button>
        </Group>

        {status && <Text c={status.startsWith('Error') ? 'red' : 'green'}>{status}</Text>}
      </Stack>
    </Card>
  );
}

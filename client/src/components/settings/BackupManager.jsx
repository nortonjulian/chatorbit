import React, { useState } from 'react';
import {
  createEncryptedKeyBackup,
  restoreEncryptedKeyBackup,
  createEncryptedChatBackup,
  restoreEncryptedChatBackup,
} from '../../utils/backupClient.js';

/**
 * Utility for downloading a Blob
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ChatBackupManager({
  currentUserId,
  roomId,
  fetchPage, // required for chat backup
  fetchPublicKeys, // optional for chat backup
}) {
  const [status, setStatus] = useState('');
  const [backupPassword, setBackupPassword] = useState('');
  const [localPasscode, setLocalPasscode] = useState('');
  const [restoreFile, setRestoreFile] = useState(null);

  // === KEY BACKUP ===
  async function handleKeyBackup() {
    try {
      setStatus('Creating key backup...');
      const { blob, filename } = await createEncryptedKeyBackup({
        unlockPasscode: localPasscode,
        backupPassword,
      });
      downloadBlob(blob, filename);
      setStatus(`Key backup saved as ${filename}`);
    } catch (err) {
      console.error(err);
      setStatus(`Key backup failed: ${err.message}`);
    }
  }

  async function handleKeyRestore() {
    try {
      setStatus('Restoring key backup...');
      await restoreEncryptedKeyBackup({
        file: restoreFile,
        backupPassword,
        setLocalPasscode: localPasscode,
      });
      setStatus('Key backup restored!');
    } catch (err) {
      console.error(err);
      setStatus(`Key restore failed: ${err.message}`);
    }
  }

  // === CHAT BACKUP ===
  async function handleChatBackup() {
    try {
      setStatus('Creating chat backup...');
      const { blob, filename } = await createEncryptedChatBackup({
        roomId,
        currentUserId,
        passcodeToUnlockKeys: localPasscode,
        password: backupPassword,
        fetchPage,
        fetchPublicKeys,
        includeMedia: true,
      });
      downloadBlob(blob, filename);
      setStatus(`Chat backup saved as ${filename}`);
    } catch (err) {
      console.error(err);
      setStatus(`Chat backup failed: ${err.message}`);
    }
  }

  async function handleChatRestore() {
    try {
      setStatus('Restoring chat backup...');
      const result = await restoreEncryptedChatBackup({
        file: restoreFile,
        password: backupPassword,
      });
      console.log('Restored chat JSON:', result);
      setStatus(`Chat backup restored with ${result?.messages?.length || 0} messages`);
    } catch (err) {
      console.error(err);
      setStatus(`Chat restore failed: ${err.message}`);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Backup & Restore</h2>

      <div className="space-y-2">
        <label className="block">
          Local Passcode:
          <input
            type="password"
            value={localPasscode}
            onChange={(e) => setLocalPasscode(e.target.value)}
            className="border p-1 ml-2"
          />
        </label>
        <label className="block">
          Backup Password:
          <input
            type="password"
            value={backupPassword}
            onChange={(e) => setBackupPassword(e.target.value)}
            className="border p-1 ml-2"
          />
        </label>
      </div>

      <div className="space-y-2">
        <button
          onClick={handleKeyBackup}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          Backup Keys
        </button>
        <button
          onClick={handleKeyRestore}
          className="bg-green-600 text-white px-3 py-1 rounded"
          disabled={!restoreFile}
        >
          Restore Keys
        </button>
      </div>

      <div className="space-y-2">
        <button
          onClick={handleChatBackup}
          className="bg-purple-600 text-white px-3 py-1 rounded"
        >
          Backup Chat
        </button>
        <button
          onClick={handleChatRestore}
          className="bg-pink-600 text-white px-3 py-1 rounded"
          disabled={!restoreFile}
        >
          Restore Chat
        </button>
      </div>

      <div className="space-y-2">
        <input
          type="file"
          accept=".json"
          onChange={(e) => setRestoreFile(e.target.files[0])}
        />
      </div>

      <div className="text-sm text-gray-700">{status}</div>
    </div>
  );
}

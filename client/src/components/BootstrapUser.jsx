import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useUser } from '../context/UserContext';
import { generateKeypair, loadKeysLocal, saveKeysLocal } from '../utils/keys';
import { migrateLocalToIDBIfNeeded } from '../utils/keyStore';
import KeySetupModal from './KeySetupModal';

export default function BootstrapUser() {
  const { currentUser, setCurrentUser } = useUser();
  const [askedThisSession, setAskedThisSession] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [haveServerPubKey, setHaveServerPubKey] = useState(false);

  // Restore user from localStorage if context empty
  useEffect(() => {
    if (!currentUser) {
      const saved = localStorage.getItem('user');
      if (saved) {
        try { setCurrentUser(JSON.parse(saved)); } catch {}
      }
    }
  }, [currentUser, setCurrentUser]);

  useEffect(() => {
    const handler = () => {
        setCurrentUser(null);
        window.location.href = '/'
    }
    window.addEventListener('auth-logout', handler)
    return () => window.removeEventListener('auth-logout', handler)
  }, [setCurrentUser])

  // Migrate any legacy localStorage keys → IndexedDB (one-time)
  useEffect(() => {
    migrateLocalToIDBIfNeeded().catch(() => {});
  }, []);

  // Ensure keys exist on this device, prompt only if missing
  useEffect(() => {
    (async () => {
      if (!currentUser || askedThisSession) return;

      const { publicKey, privateKey } = await loadKeysLocal();
      if (privateKey) return; // device already has private key

      setAskedThisSession(true);

      const serverHasPub = Boolean(currentUser.publicKey);
      setHaveServerPubKey(serverHasPub);

      if (!serverHasPub) {
        // new account → silently generate once and upload
        try {
          const kp = generateKeypair();
          await saveKeysLocal(kp);
          await axiosClient.post('/users/keys', { publicKey: kp.publicKey });
          setCurrentUser((prev) => ({ ...prev, publicKey: kp.publicKey }));
          localStorage.setItem('user', JSON.stringify({ ...currentUser, publicKey: kp.publicKey }));
        } catch (e) {
          console.error('Public key upload failed', e);
          setKeyModalOpen(true);
        }
      } else {
        // existing user, no local private key → ask once
        setKeyModalOpen(true);
      }
    })();
  }, [currentUser, askedThisSession, setCurrentUser]);

  return (
    <>
      <KeySetupModal
        opened={keyModalOpen}
        haveServerPubKey={haveServerPubKey}
        onClose={() => setKeyModalOpen(false)}
      />
      {null}
    </>
  );
}

import { useEffect } from 'react';
import { useUser } from '../context/UserContext';

export default function BootstrapUser() {
  const { currentUser, setCurrentUser } = useUser();

  useEffect(() => {
    if (!currentUser) {
      const saved = localStorage.getItem('user');
      if (saved) {
        try {
          setCurrentUser(JSON.parse(saved));
        } catch {
          // ignore bad JSON
        }
      }
    }
  }, [currentUser, setCurrentUser]);

  return null; // renders nothing
}

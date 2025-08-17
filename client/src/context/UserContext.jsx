import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axiosClient from '../api/axiosClient';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true); // while probing /auth/me
  const [authError, setAuthError] = useState(null);

  // One-time bootstrap: “who am I?”
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const { data } = await axiosClient.get('/auth/me'); // cookie-only
        if (!cancelled) setCurrentUser(data.user);
      } catch (err) {
        if (!cancelled) {
          // 401 = not logged in; treat as null user, not an error
          if (err?.response?.status !== 401) setAuthError('Failed to verify session');
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    bootstrap();

    // If any API call returns 401, log out globally
    const onUnauthorized = () => setCurrentUser(null);
    window.addEventListener('auth-unauthorized', onUnauthorized);

    return () => {
      cancelled = true;
      window.removeEventListener('auth-unauthorized', onUnauthorized);
    };
  }, []);

  const value = useMemo(
    () => ({ currentUser, setCurrentUser, authLoading, authError }),
    [currentUser, authLoading, authError]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}

export { UserContext };

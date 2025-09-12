import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import { useSocket } from './SocketContext';   // ✅ socket lifecycle

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const { refreshRooms, reconnect, disconnect } = useSocket();  // ✅

  const bootstrap = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { data } = await axiosClient.get('/auth/me'); // cookie-only
      setCurrentUser(data.user);

      // ✅ Ensure socket is up and joined to rooms for this user
      reconnect?.();           // re-init socket for this identity (safe if already connected)
      await refreshRooms?.();  // triggers join:rooms
    } catch (err) {
      if (err?.response?.status !== 401) setAuthError('Failed to verify session');
      setCurrentUser(null);
      // ✅ Not logged in → ensure socket is disconnected
      disconnect?.();
    } finally {
      setAuthLoading(false);
    }
  }, [reconnect, refreshRooms, disconnect]);

  useEffect(() => {
    bootstrap();

    // Global 401 handler → treat as logout
    const onUnauthorized = () => {
      setCurrentUser(null);
      disconnect?.();
    };
    window.addEventListener('auth-unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', onUnauthorized);
  }, [bootstrap, disconnect]);

  // Optional: explicit logout helper
  const logout = useCallback(async () => {
    try { await axiosClient.post('/auth/logout'); } catch {}
    // If you also store a token client-side, clear it here:
    // localStorage.removeItem('token');
    setCurrentUser(null);
    disconnect?.();
  }, [disconnect]);

  const value = useMemo(
    () => ({ currentUser, setCurrentUser, authLoading, authError, logout }),
    [currentUser, authLoading, authError, logout]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}

export { UserContext };

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import axiosClient from '@/api/axiosClient';
import { useSocket } from './SocketContext'; // socket lifecycle

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const { refreshRooms, reconnect, disconnect } = useSocket();

  const bootstrap = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { data } = await axiosClient.get('/auth/me'); // cookie-only auth
      // support either { user: ... } or a plain user object
      const user = data?.user ?? data;
      setCurrentUser(user);

      // Ensure socket is up and joined to rooms for this user
      reconnect?.();           // re-init socket for this identity (safe if already connected)
      await refreshRooms?.();  // triggers join:rooms
    } catch (err) {
      if (err?.response?.status === 401) {
        // not logged in — normal in fresh sessions
        setCurrentUser(null);
      } else {
        console.warn('Failed to load /auth/me', err?.message || err);
        setAuthError('Failed to verify session');
        setCurrentUser(null);
      }
      // Not logged in or errored → ensure socket is disconnected
      disconnect?.();
    } finally {
      setAuthLoading(false);
    }
  }, [reconnect, refreshRooms, disconnect]);

  useEffect(() => {
    bootstrap();

    // Optional: global 401 -> treat as logout
    const onUnauthorized = () => {
      setCurrentUser(null);
      disconnect?.();
    };
    window.addEventListener('auth-unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', onUnauthorized);
  }, [bootstrap, disconnect]);

  // Explicit logout helper
  const logout = useCallback(async () => {
    try {
      await axiosClient.post(
        '/auth/logout',
        null,
        { headers: { 'X-Requested-With': 'XMLHttpRequest' } }
      );
    } catch {
      // ignore
    }
    // Clear any dev tokens that might keep sockets reconnecting
    localStorage.removeItem('token');
    localStorage.removeItem('foria_jwt');
    // If you ever stored a non-HttpOnly cookie in dev, clear it too:
    document.cookie = 'foria_jwt=; Max-Age=0; path=/';
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

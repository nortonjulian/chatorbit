import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import axiosClient from '../api/axiosClient';

const SocketCtx = createContext(null);

export function SocketProvider({ children, autoJoin = true }) {
  const [socket, setSocket] = useState(null);
  const [roomIds, setRoomIds] = useState([]);

  const connect = useCallback(() => {
    // Pull token if you store one client-side; otherwise rely on HttpOnly cookie
    const token = localStorage.getItem('token');
    const s = io(import.meta.env.VITE_SOCKET_ORIGIN || 'http://localhost:5002', {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true,
      auth: token ? { token } : undefined,
    });
    s.on('connect_error', (err) => console.error('WS connect error', err?.message || err));
    setSocket(s);
    return s;
  }, []);

  const disconnect = useCallback(() => {
    try {
      if (socket?.connected) {
        // Optionally tell server we're leaving (not strictly required if disconnecting)
        if (Array.isArray(roomIds) && roomIds.length) {
          try { socket.emit('leave_room_bulk', roomIds); } catch {}
        }
        socket.disconnect();
      }
    } finally {
      setSocket(null);
    }
  }, [socket, roomIds]);

  const reconnect = useCallback(() => {
    disconnect();
    const s = connect();
    return s;
  }, [connect, disconnect]);

  // Fetch rooms the user belongs to
  async function refreshRooms() {
    try {
      const { data } = await axiosClient.get('/chatrooms/mine?select=id');
      const ids = (data?.items || data || []).map((r) => String(r.id));
      setRoomIds(ids);
    } catch (e) {
      console.warn('Failed to load my rooms', e?.message || e);
      setRoomIds([]);
    }
  }

  // Initial connect on mount
  useEffect(() => {
    const s = connect();
    return () => {
      try { s?.disconnect(); } catch {}
    };
  }, [connect]);

  // Bulk join whenever the room ids change
  useEffect(() => {
    if (!socket || !socket.connected || !roomIds?.length) return;
    socket.emit('join:rooms', roomIds);
  }, [socket, roomIds]);

  const value = useMemo(
    () => ({ socket, refreshRooms, setRoomIds, connect, disconnect, reconnect }),
    [socket, connect, disconnect, reconnect]
  );

  return <SocketCtx.Provider value={value}>{children}</SocketCtx.Provider>;
}

export function useSocket() {
  return useContext(SocketCtx);
}

// src/hooks/useDeviceEvents.js
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { notifications } from '@mantine/notifications';

/**
 * Listens for device events from Socket.IO and triggers callbacks.
 *
 * Options:
 * - userId (string|number)   : required if no custom auth is provided
 * - onLinked(payload)        : called when a device is linked
 * - onRevoked(payload)       : called when a device is revoked
 * - onProvisionReady(payload): called when provisioning payload is ready
 * - showToasts (boolean)     : default true; show Mantine notifications
 * - socket (Socket)          : optional existing socket instance to reuse
 * - url (string)             : optional server URL; defaults to window.origin
 * - auth (object|function)   : custom auth payload or () => payload
 */
export function useDeviceEvents({
  userId,
  onLinked,
  onRevoked,
  onProvisionReady,
  showToasts = true,
  socket: externalSocket,
  url,
  auth,
} = {}) {
  const createdHere = useRef(false);
  const sockRef = useRef(null);

  useEffect(() => {
    if (!externalSocket) {
      const serverURL = url || (import.meta?.env?.VITE_SOCKET_URL ?? window.location.origin);

      // resolve auth payload
      let authPayload = typeof auth === 'function' ? auth() : auth;
      if (!authPayload) {
        // fallback: JWT from storage or userId room auth
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
        authPayload = token ? { token } : userId ? { userId } : {};
      }

      sockRef.current = io(serverURL, {
        autoConnect: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        withCredentials: true,
        auth: authPayload,
      });
      createdHere.current = true;
    } else {
      sockRef.current = externalSocket;
      createdHere.current = false;
    }

    const socket = sockRef.current;
    if (!socket) return;

    const onLinkedHandler = (p) => {
      if (showToasts) notifications.show({ title: 'Device linked', message: p?.device?.name || 'A new device was linked', color: 'green' });
      onLinked?.(p);
    };
    const onRevokedHandler = (p) => {
      if (showToasts) notifications.show({ title: 'Device revoked', message: 'A device was revoked', color: 'yellow' });
      onRevoked?.(p);
    };
    const onProvisionReadyHandler = (p) => {
      onProvisionReady?.(p);
    };

    socket.on('device:linked', onLinkedHandler);
    socket.on('device:revoked', onRevokedHandler);
    socket.on('provision:ready', onProvisionReadyHandler);

    // Optional: log basic connection changes
    const onConnect = () => console.debug('socket connected', socket.id);
    const onDisconnect = (r) => console.debug('socket disconnected', r);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('device:linked', onLinkedHandler);
      socket.off('device:revoked', onRevokedHandler);
      socket.off('provision:ready', onProvisionReadyHandler);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      // Only close if we created this socket instance
      if (createdHere.current) {
        try { socket.close(); } catch {}
      }
    };
  }, [userId, url, showToasts, externalSocket]);
}

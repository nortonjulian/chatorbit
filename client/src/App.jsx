import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import { UserProvider, useUser } from '@/context/UserContext';
import BootstrapUser from '@/components/BootstrapUser';
import AppRoutes from './AppRoutes';
import socket from '@/lib/socket';

// THEME: set global defaults for inputs & buttons
const theme = createTheme({
  fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  defaultRadius: 'xl', // was 'lg'
  colors: {
    orbit: ['#e7f1ff','#c9dfff','#a9ccff','#86b6ff','#63a0ff','#418aff','#2f73e6','#255bb4','#1b4483','#122c52'],
    orbitYellow: ['#fff9e6','#ffefbf','#ffe596','#ffdb6b','#ffd241','#ffc818','#e0ab00','#b38700','#856400','#573e00'],
  },
  primaryColor: 'orbit',
  primaryShade: 6,
  components: {
    TextInput: { defaultProps: { size: 'md', variant: 'filled' } },
    PasswordInput: { defaultProps: { size: 'md', variant: 'filled' } },
    Button: { defaultProps: { radius: 'xl', size: 'md' } },
  },
});

// Join the per-user socket room globally
function SocketJoiner() {
  const { currentUser } = useUser();
  useEffect(() => {
    if (currentUser?.id) socket.emit('join_user', currentUser.id);
  }, [currentUser?.id]);
  return null;
}

export default function App() {
  return <AppRoutes />;
}

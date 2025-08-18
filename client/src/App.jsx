import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import {
  AppShell,
  Burger,
  Button,
  Card,
  Group,
  Title,
  Text,
  ScrollArea,
  Center,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Notifications } from '@mantine/notifications';
import SettingsBackups from './pages/SettingsBackups.jsx';
import UpgradePage from './pages/UpgradePage.jsx'; // ✅ new import

import { useUser } from './context/UserContext';
import BootstrapUser from './components/BootstrapUser';

import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import LoginForm from './components/LoginForm';
import Registration from './components/Registration';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import PeoplePage from './pages/PeoplePage';
import JoinInvitePage from './pages/JoinInvitePage.jsx';
import ChatHome from './components/ChatHome.jsx';

// ✅ Admin pieces
import AdminReportsPage from './pages/AdminReports';
import AdminRoute from './routes/AdminRoute';
import AdminLayout from './pages/AdminLayout';
import UsersAdminPage from './pages/UsersAdminPage';
import Forbidden from './pages/Forbidden';
import AuditLogsPage from './pages/AuditLogsPage';

// 🔌 Socket for per-user room join
import socket from './lib/socket';

// ✅ Feature flags (server-driven)
import { fetchFeatures } from './lib/features';
import StatusFeed from './pages/StatusFeed.jsx';

// 🔔 Calls
import CallManager from './components/CallManager';

// 🔐 HTTP client for logout
import axiosClient from './api/axiosClient';

export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const [selectedRoom, setSelectedRoom] = useState(null);

  const { currentUser, setCurrentUser } = useUser();

  const [features, setFeatures] = useState({ status: false });

  useEffect(() => {
    fetchFeatures()
      .then(setFeatures)
      .catch(() => setFeatures({ status: false }));
  }, []);

  useEffect(() => {
    if (currentUser?.id) {
      socket.emit('join_user', currentUser.id);
    }
  }, [currentUser?.id]);

  const handleLogout = async () => {
    try {
      await axiosClient.post('/auth/logout');
    } catch (err) {
      console.warn('Logout error', err);
    } finally {
      setCurrentUser(null);
    }
  };

  const AuthedLayout = () => (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" />
            <Title order={3}>ChatOrbit</Title>
          </Group>
          <Button color="red" variant="filled" onClick={handleLogout}>
            Log Out
          </Button>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <ScrollArea.Autosize mah="calc(100vh - 120px)">
          <Sidebar
            currentUser={currentUser}
            setSelectedRoom={setSelectedRoom}
            features={features}
          />
        </ScrollArea.Autosize>
      </AppShell.Navbar>

      <AppShell.Main>
        <CallManager />
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );

  return (
    <>
      <Notifications position="top-right" />
      <BootstrapUser />

      {!currentUser ? (
        <Routes>
          <Route path="/" element={<LoginForm />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/forbidden" element={<Forbidden />} />
          <Route path="/" element={<AuthedLayout />}>
            <Route
              index
              element={
                <ChatHome currentUser={currentUser}>
                  {selectedRoom ? (
                    <Card withBorder radius="xl" p="lg">
                      <Title order={4} mb="sm">
                        {selectedRoom?.name || 'Chat'}
                      </Title>
                      <ChatView
                        chatroom={selectedRoom}
                        currentUserId={currentUser.id}
                        currentUser={currentUser}
                      />
                    </Card>
                  ) : (
                    <Center mih="70vh">
                      <Text c="dimmed">
                        Select a text or chatroom to begin chatting
                      </Text>
                    </Center>
                  )}
                </ChatHome>
              }
            />

            <Route path="people" element={<PeoplePage />} />
            <Route path="settings/backups" element={<SettingsBackups />} />
            <Route path="settings/upgrade" element={<UpgradePage />} /> 
            <Route path="/join/:code" element={<JoinInvitePage />} />

            {features.status && (
              <Route path="status" element={<StatusFeed />} />
            )}

            <Route
              path="admin"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route path="users" element={<UsersAdminPage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="audit" element={<AuditLogsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        </Routes>
      )}
    </>
  );
}

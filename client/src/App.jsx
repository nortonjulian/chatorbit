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

export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const [selectedRoom, setSelectedRoom] = useState(null);

  const { currentUser, setCurrentUser } = useUser();

  // Join per-user Socket.IO room so server can push targeted events (e.g., status updates)
  useEffect(() => {
    if (currentUser?.id) {
      socket.emit('join_user', currentUser.id);
    }
  }, [currentUser?.id]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
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
          <Sidebar currentUser={currentUser} setSelectedRoom={setSelectedRoom} />
        </ScrollArea.Autosize>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );

  return (
    <>
      {/* 🔔 Global Notifications */}
      <Notifications position="top-right" />

      <BootstrapUser />

      {!currentUser ? (
        // Public routes
        <Routes>
          <Route path="/" element={<LoginForm />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      ) : (
        // Authenticated routes
        <Routes>
          <Route path="/forbidden" element={<Forbidden />} />
          <Route path="/" element={<AuthedLayout />}>
            {/* 👇 ChatHome wrapper WITH children + currentUser prop */}
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
                      <Text c="dimmed">Select a text or chatroom to begin chatting</Text>
                    </Center>
                  )}
                </ChatHome>
              }
            />

            <Route path="people" element={<PeoplePage />} />
            <Route path="settings/backups" element={<SettingsBackups />} />
            <Route path="/join/:code" element={<JoinInvitePage />} />

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

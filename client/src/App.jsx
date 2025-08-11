import { useState } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AppShell, Burger, Button, Card, Group, Title, Text, ScrollArea, Center } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

import { useUser } from './context/UserContext';
import BootstrapUser from './components/BootstrapUser';

import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import LoginForm from './components/LoginForm';
import Registration from './components/Registration';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import PeoplePage from './pages/PeoplePage';

// ✅ Admin pieces
import AdminReportsPage from './pages/AdminReports';
import AdminRoute from './routes/AdminRoute';
import AdminLayout from './pages/AdminLayout';
import UsersAdminPage from './pages/UsersAdminPage';
import Forbidden from './pages/Forbidden';
import AuditLogsPage from './pages/AuditLogsPage';


export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const [selectedRoom, setSelectedRoom] = useState(null);

  const { currentUser, setCurrentUser } = useUser();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
  };

  const ChatHome = () => (
    selectedRoom ? (
      <Card withBorder radius="xl" p="lg">
        <Title order={4} mb="sm">{selectedRoom?.name || 'Chat'}</Title>
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
    )
  );

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
        {/* where child routes render */}
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );

  return (
    <>
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
        // Authenticated routes (AppShell layout + children)
        <Routes>
          {/* You can allow anyone to see a 403 page if they somehow hit it */}
          <Route path="/forbidden" element={<Forbidden />} />

          <Route path="/" element={<AuthedLayout />}>
            {/* index = main chat UI */}
            <Route index element={<ChatHome />} />
            <Route path="people" element={<PeoplePage />} />

            {/* admin branch, guarded */}
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

            {/* catch-all under authed layout */}
            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        </Routes>
      )}
    </>
  );
}

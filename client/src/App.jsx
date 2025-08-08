// src/App.jsx
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const [selectedRoom, setSelectedRoom] = useState(null);

  // ✅ use global context user
  const { currentUser, setCurrentUser } = useUser();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
  };

  return (
    <>
      {/* Hydrate context from localStorage on first mount */}
      <BootstrapUser />

      {/* Public routes */}
      {!currentUser ? (
        <Routes>
          {/* LoginForm already sets context itself; passing this prop is optional */}
          <Route path="/" element={<LoginForm onLoginSuccess={setCurrentUser} />} />
          <Route path="/register" element={<Registration onRegisterSuccess={setCurrentUser} />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      ) : (
        // Authenticated layout
        <Routes>
          <Route
            path="/"
            element={
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
                </AppShell.Main>
              </AppShell>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      )}
    </>
  );
}
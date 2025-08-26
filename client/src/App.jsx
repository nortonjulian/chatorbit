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

// 🔔 Calls (modal that listens for 'call:ring', and in-call UI)
import IncomingCallModal from './components/IncomingCallModal.jsx';
import VideoCall from './components/VideoCall.jsx';

// 🔐 HTTP client for logout
import axiosClient from './api/axiosClient';

export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const [selectedRoom, setSelectedRoom] = useState(null);

  const { currentUser, setCurrentUser } = useUser();

  const [features, setFeatures] = useState({ status: false });

  // ⬇️ global in-app call state for conditional rendering of VideoCall
  const [activeCall, setActiveCall] = useState(null);
  // shape example:
  // {
  //   callId,
  //   partnerId,            // user id of the other party
  //   mode: 'VIDEO'|'AUDIO',
  //   chatId: number|null,
  //   inbound: true|false,  // did we receive the invite?
  //   offerSdp?: string     // if inbound, initial offer from server ring event
  // }

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

  // Accept incoming call → mount VideoCall
  const handleAcceptIncoming = (payload) => {
    // payload matches what your server emits on 'call:ring'
    // { callId, fromUserId, chatId, mode, sdp, createdAt }
    setActiveCall({
      callId: payload.callId,
      partnerId: payload.fromUserId,
      chatId: payload.chatId ?? null,
      mode: payload.mode || 'VIDEO',
      inbound: true,
      offerSdp: payload.sdp, // pass down so VideoCall can setRemoteDescription(offer) then createAnswer
    });
  };

  // Reject incoming → no active call
  const handleRejectIncoming = () => {
    setActiveCall(null);
  };

  // End the active call (VideoCall will call this on hangup)
  const handleEndCall = () => {
    setActiveCall(null);
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
            // Optional: expose a way for ChatView/Sidebar to start an outbound call
            // onStartCall={(partnerId, mode='VIDEO', chatId=null) => {
            //   setActiveCall({ partnerId, mode, chatId, inbound: false });
            // }}
          />
        </ScrollArea.Autosize>
      </AppShell.Navbar>

      <AppShell.Main>
        {/* 🔔 Always-mounted modal that listens for 'call:ring' internally.
            When user clicks "Accept", it calls onAccept(payload). */}
        <IncomingCallModal
          onAccept={handleAcceptIncoming}
          onReject={handleRejectIncoming}
        />

        {/* 🎥 Only render the call UI when a call is active (inbound or outbound) */}
        {activeCall && (
          <VideoCall
            call={activeCall}
            currentUser={currentUser}
            onEnd={handleEndCall}
            // You can pass socket in if your VideoCall expects its own instance,
            // but typically it will import the shared /lib/socket the same way as here.
          />
        )}

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
                        // If you want to start an outbound call from inside ChatView:
                        // onStartCall={(partnerId, mode='VIDEO') => {
                        //   setActiveCall({ partnerId, mode, chatId: selectedRoom.id, inbound: false });
                        // }}
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

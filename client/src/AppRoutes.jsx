import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import {
  AppShell,
  Burger,
  Button,
  Group,
  Title,
  Text,
  ScrollArea,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

import { useUser } from '@/context/UserContext';
import { RequirePremium } from '@/routes/guards';

// pages / components
import SettingsBackups from '@/pages/SettingsBackups.jsx';
import UpgradePage from '@/pages/UpgradePlan';
import Sidebar from '@/components/Sidebar';
import LoginForm from '@/components/LoginForm';
import Registration from '@/components/Registration';
import ForgotPassword from '@/components/ForgotPassword';
import ResetPassword from '@/components/ResetPassword';
import PeoplePage from '@/pages/PeoplePage';
import JoinInvitePage from '@/pages/JoinInvitePage.jsx';

// Admin
import AdminReportsPage from '@/pages/AdminReports';
import AdminRoute from '@/routes/AdminRoute';
import AdminLayout from '@/pages/AdminLayout';
import UsersAdminPage from '@/pages/UsersAdminPage';
import Forbidden from '@/pages/Forbidden';
import AuditLogsPage from '@/pages/AuditLogsPage';

// Feature flags
import { fetchFeatures } from '@/lib/features';
import StatusFeed from '@/pages/StatusFeed.jsx';
import Advertise from './pages/Advertise';

// Calls (ring modal + in-call UI)
import IncomingCallModal from '@/components/IncomingCallModal.jsx';
import VideoCall from '@/components/VideoCall.jsx';

// HTTP
import api from '@/api/axiosClient';

// Public layout
import AuthLayout from '@/components/AuthLayout';

// New: settings page (Appearance + Sounds)
import SettingsPage from '@/features/settings/SettingsPage';

// Index route content — reads selectedRoom from Outlet context
import HomeIndex from '@/features/chat/HomeIndex';

function AuthedLayout() {
  const [opened, { toggle }] = useDisclosure();
  const [selectedRoom, setSelectedRoom] = useState(null);
  const { currentUser, setCurrentUser } = useUser();

  const [features, setFeatures] = useState({ status: false });

  // Global in-app call state (for VideoCall)
  const [activeCall, setActiveCall] = useState(null);

  useEffect(() => {
    fetchFeatures()
      .then(setFeatures)
      .catch(() => setFeatures({ status: false }));
  }, []);

  // Updated logout: call API, then nuke client state and hard-redirect
  const handleLogout = async () => {
    try {
      await api.post('/auth/logout'); // relative path so Vite proxy handles CORS in dev
    } catch (_err) {
      // ignore — we’ll clear client state anyway
    } finally {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
      setCurrentUser(null);
      window.location.assign('/login');
    }
  };

  const handleAcceptIncoming = (payload) => {
    setActiveCall({
      callId: payload.callId,
      partnerId: payload.fromUserId,
      chatId: payload.chatId ?? null,
      mode: payload.mode || 'VIDEO',
      inbound: true,
      offerSdp: payload.sdp,
    });
  };

  return (
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
        {/* Incoming call modal */}
        <IncomingCallModal
          onAccept={handleAcceptIncoming}
          onReject={() => setActiveCall(null)}
        />

        {/* In-call UI */}
        {activeCall && (
          <VideoCall
            call={activeCall}
            currentUser={currentUser}
            onEnd={() => setActiveCall(null)}
          />
        )}

        {/* Pass room + user down to index route via Outlet context */}
        <Outlet context={{ selectedRoom, setSelectedRoom, currentUser, features }} />
      </AppShell.Main>
    </AppShell>
  );
}

export default function AppRoutes() {
  const { currentUser } = useUser();

  if (!currentUser) {
    return (
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/" element={<LoginForm />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/download" element={<Text>Download page coming soon.</Text>} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/forbidden" element={<Forbidden />} />
      <Route path="/" element={<AuthedLayout />}>
        {/* ⬇️ Index route uses the same conditional you had before */}
        <Route index element={<HomeIndex />} />

        <Route path="people" element={<PeoplePage />} />
        <Route path="settings" element={<SettingsPage />} />

        {/* Premium-gated page */}
        <Route
          path="settings/backups"
          element={
            <RequirePremium>
              <SettingsBackups />
            </RequirePremium>
          }
        />

        <Route path="settings/upgrade" element={<UpgradePage />} />
        <Route path="/join/:code" element={<JoinInvitePage />} />

        {/* feature-flagged */}
        <Route path="status" element={<StatusFeed />} />

        {/* Admin */}
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
  );
}

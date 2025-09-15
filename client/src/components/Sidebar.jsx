import { useState } from 'react';
import {
  Box,
  Group,
  ActionIcon,
  ScrollArea,
  Divider,
  Stack,
  Drawer,
  Text,
  Button,
} from '@mantine/core';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Plus, Users, Settings } from 'lucide-react';

import StartChatModal from './StartChatModal';
import ChatroomsSidebar from './ChatroomsSidebar'; // <-- new sidebar list with loading/empty/error handling
import UserProfile from './UserProfile';

function Sidebar({ currentUser, setSelectedRoom, features }) {
  const [showStartModal, setShowStartModal] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();

  const handleStartChat = () => {
    if (!currentUser) return;
    setShowStartModal(true);
  };

  return (
    <Box p="md" h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Top icons */}
      <Group justify="space-between" mb="sm">
        <ActionIcon
          variant="subtle"
          onClick={handleStartChat}
          aria-label="Start chat"
          disabled={!currentUser}
        >
          <Plus size={22} />
        </ActionIcon>

        <ActionIcon
          variant="subtle"
          aria-label="Users"
          onClick={() => navigate('/people')}
        >
          <Users size={22} />
        </ActionIcon>

        <ActionIcon
          variant="subtle"
          aria-label="Settings"
          onClick={() => currentUser && setProfileOpen(true)}
          disabled={!currentUser}
        >
          <Settings size={22} />
        </ActionIcon>
      </Group>

      <Divider mb="sm" />

      {/* Optional quick links */}
      <Stack gap="xs" mb="sm">
        {features?.status && <NavLink to="/status">Status</NavLink>}
      </Stack>

      {/* Main sidebar content */}
      <ScrollArea.Autosize style={{ flex: 1 }} mah="calc(100vh - 160px)">
        <Stack gap="md">
          {/* Chatrooms list (renders: skeleton → list OR nothing/compact empty state) */}
          <ChatroomsSidebar
            onStartNewChat={() => setShowStartModal(true)}
            onSelect={setSelectedRoom} // optional: implement inside ChatroomsSidebar to call when a room is clicked
          />
        </Stack>
      </ScrollArea.Autosize>

      {/* Start Chat modal */}
      {showStartModal && currentUser && (
        <StartChatModal
          currentUserId={currentUser?.id}
          onClose={() => setShowStartModal(false)}
        />
      )}

      {/* Settings drawer */}
      <Drawer
        opened={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="Settings"
        position="right"
        size="md"
        radius="lg"
        overlayProps={{ opacity: 0.15, blur: 2 }}
      >
        {currentUser ? (
          <UserProfile onLanguageChange={() => {}} />
        ) : (
          <Stack gap="sm">
            <Text c="dimmed">Log in to edit your settings.</Text>
            <Group>
              <Button component={Link} to="/" variant="filled">
                Log in
              </Button>
              <Button component={Link} to="/register" variant="light">
                Create account
              </Button>
            </Group>
          </Stack>
        )}
      </Drawer>
    </Box>
  );
}

export default Sidebar;

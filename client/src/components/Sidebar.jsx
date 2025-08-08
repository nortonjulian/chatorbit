import { useState } from 'react';
import { 
  Box, 
  Group, 
  ActionIcon, 
  Title, 
  ScrollArea, 
  Divider, 
  Stack, 
  Drawer, 
  Text } from '@mantine/core';
import { Plus, Users, Settings } from 'lucide-react';
import StartChatModal from './StartChatModal';
import UsersList from './UsersList';
import ChatroomList from './ChatroomList';
import UserProfile from './UserProfile';

function Sidebar({ currentUser, setSelectedRoom }) {
  const [showStartModal, setShowStartModal] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <Box p="md" h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Top icons */}
      <Group justify="space-between" mb="sm">
        <ActionIcon
          variant="subtle"
          onClick={() => setShowStartModal(true)}
          aria-label="Start chat"
        >
          <Plus size={22} />
        </ActionIcon>

        <ActionIcon variant="subtle" aria-label="Users">
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

      {/* Main sidebar content */}
      <ScrollArea.Autosize style={{ flex: 1 }} mah="calc(100vh - 160px)">
        <Stack gap="md">
          <Box>
            <Title order={5} mb="xs">
              Users
            </Title>
            <UsersList currentUser={currentUser} />
          </Box>

          <Box>
            <Title order={5} mb="xs">
              Chatrooms
            </Title>
            <ChatroomList currentUser={currentUser} onSelect={setSelectedRoom} />
          </Box>
        </Stack>
      </ScrollArea.Autosize>

      {/* Start Chat modal */}
      {showStartModal && (
        <StartChatModal
          currentUserId={currentUser.id}
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
        <UserProfile onLanguageChange={() => {}} />
            {currentUser ? (
              <UserProfile onLanguageChange={() => {}} />
            ) : (
              <Text c="dimmed">Log in to edit your settings.</Text>
            )}
      </Drawer>
    </Box>
  );
}

export default Sidebar;

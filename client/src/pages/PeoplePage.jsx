import { useState } from 'react';
import { Title, Group, Button, Paper } from '@mantine/core';
import { useUser } from '../context/UserContext';
import StartChatModal from '../components/StartChatModal';
import ContactList from '../components/ContactList';

export default function PeoplePage() {
  const { currentUser } = useUser();
  const [open, setOpen] = useState(false);

  if (!currentUser) return null;

  return (
    <div>
      <Group justify="space-between" mb="sm">
        <Title order={4}>People</Title>
        <Button onClick={() => setOpen(true)}>Find / Add Contact</Button>
      </Group>

      <Paper withBorder radius="xl" p="md">
        <ContactList currentUserId={currentUser.id} />
      </Paper>

      {open && (
        <StartChatModal
          currentUserId={currentUser.id}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

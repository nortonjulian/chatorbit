import { useOutletContext } from 'react-router-dom';
import { Card, Title, Center, Text } from '@mantine/core';
import ChatHome from '@/components/ChatHome.jsx';
import ChatView from '@/components/ChatView.jsx';

export default function HomeIndex() {
  const { selectedRoom, currentUser } = useOutletContext();

  return (
    <ChatHome currentUser={currentUser}>
      {selectedRoom ? (
        <Card withBorder radius="xl" p="lg">
          <Title order={4} mb="sm">
            {selectedRoom?.name || 'Chat'}
          </Title>
          <ChatView
            chatroom={selectedRoom}
            currentUserId={currentUser?.id}
            currentUser={currentUser}
          />
        </Card>
      ) : (
        <Center mih="70vh">
          <Text c="dimmed">Select a text or chatroom to begin chatting</Text>
        </Center>
      )}
    </ChatHome>
  );
}

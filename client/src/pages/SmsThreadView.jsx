import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import api from '@/api/axiosClient';

export default function SmsThreadView() {
  const { id } = useParams();
  const [thread, setThread] = useState(null);
  const [body, setBody] = useState('');

  const load = async () => {
    const { data } = await api.get(`/sms/threads/${id}`);
    setThread(data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const send = async () => {
    await api.post('/sms/send', { to: thread.contactPhone, body });
    setBody('');
    await load();
  };

  if (!thread) return null;

  return (
    <Stack>
      <Title order={3}>Chat with {thread.contactPhone}</Title>
      <Stack>
        {thread.messages.map(m => (
          <Text key={m.id} c={m.direction === 'out' ? 'cyan' : 'gray'}>
            <strong>{m.direction === 'out' ? 'You' : m.fromNumber}:</strong> {m.body}
          </Text>
        ))}
      </Stack>
      <Group>
        <TextInput value={body} onChange={(e)=>setBody(e.target.value)} placeholder="Reply…" />
        <Button onClick={send} disabled={!body.trim()}>Send</Button>
      </Group>
    </Stack>
  );
}

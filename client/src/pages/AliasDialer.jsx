import { useState } from 'react';
import { Button, Group, TextInput } from '@mantine/core';
import api from '@/api/axiosClient';

function AliasDialer() {
  const [to, setTo] = useState('');
  const call = async () => {
    await api.post('/voice/call', { to });
  };
  return (
    <Group mt="md">
      <TextInput
        label="Call (E.164)"
        placeholder="+15551234567"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      <Button onClick={call} disabled={!to}>
        Place Call (alias)
      </Button>
    </Group>
  );
}

export default AliasDialer;

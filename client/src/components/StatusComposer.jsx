import { useState } from 'react';
import {
  Modal,
  Group,
  Textarea,
  FileInput,
  Button,
  Select,
  Text,
} from '@mantine/core';
import axiosClient from '../api/axiosClient';

const AUDIENCE = [
  { value: 'MUTUALS', label: 'Mutual contacts' },
  { value: 'CONTACTS', label: 'All contacts' },
  { value: 'CUSTOM', label: 'Custom list (JSON ids)' }, // simple MVP
];

export default function StatusComposer({ opened, onClose }) {
  const [caption, setCaption] = useState('');
  const [files, setFiles] = useState([]);
  const [audience, setAudience] = useState('MUTUALS');
  const [custom, setCustom] = useState('[]');
  const [ttl, setTtl] = useState('86400');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const form = new FormData();
      form.append('caption', caption);
      form.append('audience', audience);
      form.append('expireSeconds', String(Number(ttl) || 86400));
      if (audience === 'CUSTOM') form.append('customAudienceIds', custom);
      files.forEach((f) => form.append('files', f));
      await axiosClient.post('/status', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCaption('');
      setFiles([]);
      setCustom('[]');
      setAudience('MUTUALS');
      setTtl('86400');
      onClose?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="New status" centered>
      <Group align="stretch" gap="sm" grow>
        <Textarea
          label="Caption (optional)"
          value={caption}
          onChange={(e) => setCaption(e.currentTarget.value)}
          autosize
          minRows={2}
        />
        <Select
          label="Audience"
          data={AUDIENCE}
          value={audience}
          onChange={setAudience}
        />
        {audience === 'CUSTOM' && (
          <Textarea
            label="Custom user IDs (JSON)"
            value={custom}
            onChange={(e) => setCustom(e.currentTarget.value)}
            autosize
            minRows={1}
          />
        )}
        <Select
          label="Expires in"
          data={[
            { value: '3600', label: '1 hour' },
            { value: '21600', label: '6 hours' },
            { value: '43200', label: '12 hours' },
            { value: '86400', label: '24 hours' },
          ]}
          value={ttl}
          onChange={setTtl}
        />
        <FileInput
          label="Media (images/video/audio)"
          value={null}
          onChange={(f) => f && setFiles((p) => [...p, f])}
          placeholder="Add file"
          accept="image/*,video/*,audio/*"
          multiple={false}
          clearable
        />
        {files.length > 0 && (
          <Text size="sm">{files.length} item(s) attached</Text>
        )}
      </Group>
      <Group justify="flex-end" mt="md">
        <Button variant="subtle" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} loading={loading} disabled={loading}>
          Post
        </Button>
      </Group>
    </Modal>
  );
}

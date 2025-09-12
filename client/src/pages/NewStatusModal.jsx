import { useState } from 'react';
import {
  Modal,
  Textarea,
  Button,
  Group,
  Select,
  FileInput,
  Stack,
  Text,
  MultiSelect,
  NumberInput,
} from '@mantine/core';
import axiosClient from '../../api/axiosClient';

export default function NewStatusModal({ opened, onClose }) {
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState('MUTUALS');
  const [customIds, setCustomIds] = useState([]);
  const [expire, setExpire] = useState(24 * 3600);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  // TODO: load contacts for CUSTOM picker (ids + labels)
  const [contactOptions, setContactOptions] = useState([]);
  const loadContacts = async () => {
    try {
      const { data } = await axiosClient.get('/contacts'); // adjust if your endpoint changed
      const opts = data.items
        ? data.items.map((c) => ({ value: String(c.user?.id || c.contactUserId), label: c.user?.username || `User #${c.contactUserId}` }))
        : (data || []).map((u) => ({ value: String(u.id), label: u.username || `User #${u.id}` }));
      setContactOptions(opts);
    } catch (e) {
      console.error('load contacts failed', e);
    }
  };

  const onSubmit = async () => {
    try {
      setBusy(true);
      const form = new FormData();
      form.set('caption', caption);
      form.set('audience', audience);
      form.set('expireSeconds', String(expire));
      if (audience === 'CUSTOM' && customIds.length) {
        form.set('customAudienceIds', JSON.stringify(customIds.map((v) => Number(v))));
      }
      for (const f of files) form.append('files', f);

      await axiosClient.post('/status', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onClose?.();
      setCaption('');
      setFiles([]);
      setCustomIds([]);
      setAudience('MUTUALS');
      setExpire(24 * 3600);
    } catch (e) {
      console.error('post status failed', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="New Status" centered>
      <Stack>
        <Textarea
          label="Caption"
          placeholder="What’s up?"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          autosize
          minRows={2}
        />

        <Group grow>
          <Select
            label="Audience"
            value={audience}
            onChange={(v) => {
              setAudience(v || 'MUTUALS');
              if (v === 'CUSTOM' && contactOptions.length === 0) loadContacts();
            }}
            data={[
              { value: 'PUBLIC', label: 'Public' },
              { value: 'FOLLOWERS', label: 'Followers' },
              { value: 'CONTACTS', label: 'Contacts' },
              { value: 'MUTUALS', label: 'Mutuals' },
              { value: 'CUSTOM', label: 'Custom...' },
            ]}
            withinPortal
          />
          <NumberInput
            label="Expires (seconds)"
            min={60}
            max={7 * 24 * 3600}
            value={expire}
            onChange={(v) => setExpire(Number(v) || 24 * 3600)}
          />
        </Group>

        {audience === 'CUSTOM' ? (
          <MultiSelect
            label="Choose recipients"
            placeholder="Select contacts"
            data={contactOptions}
            value={customIds}
            onChange={setCustomIds}
            searchable
            withinPortal
          />
        ) : null}

        <FileInput
          label="Attachments"
          placeholder="Add images/videos"
          multiple
          accept="image/*,video/*,audio/*"
          value={files}
          onChange={setFiles}
        />
        <Text size="xs" c="dimmed">Up to 5 files. 24h expiry by default.</Text>

        <Group justify="flex-end" mt="sm">
          <Button variant="light" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={onSubmit}>Post</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

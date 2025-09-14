import { useState } from 'react';
import {
  Modal,
  Group,
  Textarea,
  FileInput,
  Button,
  Select,
  Text,
  ActionIcon,
  Chip,
  Stack,
  Tooltip,
} from '@mantine/core';
import { X } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { toast } from '../utils/toast';

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

  function resetForm() {
    setCaption('');
    setFiles([]);
    setCustom('[]');
    setAudience('MUTUALS');
    setTtl('86400');
  }

  async function submit(e) {
    if (e?.preventDefault) e.preventDefault();
    if (loading) return;

    // Validate TTL
    const seconds = Number(ttl);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      toast.err('Please choose a valid expiration.');
      return;
    }

    // Validate custom audience JSON
    if (audience === 'CUSTOM') {
      try {
        const parsed = JSON.parse(custom);
        if (!Array.isArray(parsed)) throw new Error('Not an array');
      } catch {
        toast.err('Custom audience must be a JSON array of user IDs.');
        return;
      }
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('caption', caption);
      form.append('audience', audience);
      form.append('expireSeconds', String(seconds));
      if (audience === 'CUSTOM') form.append('customAudienceIds', custom);
      files.forEach((f) => form.append('files', f));

      await axiosClient.post('/status', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.ok('Your status is live.');
      resetForm();
      onClose?.();
    } catch (err) {
      const msg = err?.response?.data?.message ?? 'Try again.';
      toast.err(`Post failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  function onAddFile(f) {
    if (!f) return;
    setFiles((prev) => [...prev, f]);
  }

  function removeFileAt(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="New status"
      centered
      closeOnEscape
      trapFocus
      aria-label="New status composer"
    >
      <form onSubmit={submit}>
        <Stack gap="sm">
          <Textarea
            label="Caption (optional)"
            aria-label="Caption"
            value={caption}
            onChange={(e) => setCaption(e.currentTarget.value)}
            autosize
            minRows={2}
            disabled={loading}
          />

          <Select
            label="Audience"
            aria-label="Audience"
            data={AUDIENCE}
            value={audience}
            onChange={(v) => setAudience(v || 'MUTUALS')}
            disabled={loading}
          />

          {audience === 'CUSTOM' && (
            <Textarea
              label="Custom user IDs (JSON array)"
              description='Example: ["123","456"]'
              aria-label="Custom user IDs JSON"
              value={custom}
              onChange={(e) => setCustom(e.currentTarget.value)}
              autosize
              minRows={1}
              disabled={loading}
            />
          )}

          <Select
            label="Expires in"
            aria-label="Expires in"
            data={[
              { value: '3600', label: '1 hour' },
              { value: '21600', label: '6 hours' },
              { value: '43200', label: '12 hours' },
              { value: '86400', label: '24 hours' },
            ]}
            value={ttl}
            onChange={(v) => setTtl(v || '86400')}
            disabled={loading}
          />

          <FileInput
            label="Media (images/video/audio)"
            aria-label="Add media file"
            value={null}
            onChange={onAddFile}
            placeholder="Add file"
            accept="image/*,video/*,audio/*"
            multiple={false}
            clearable
            disabled={loading}
          />

          {files.length > 0 && (
            <Group gap="xs" wrap="wrap" aria-live="polite">
              <Text size="sm">{files.length} item(s) attached</Text>
              {files.map((f, idx) => (
                <Chip
                  key={`${f.name}-${idx}`}
                  checked
                  onChange={() => removeFileAt(idx)}
                  radius="sm"
                >
                  <Group gap={6}>
                    <Text size="sm">{f.name}</Text>
                    <Tooltip label="Remove">
                      <ActionIcon
                        aria-label={`Remove ${f.name}`}
                        size="sm"
                        variant="subtle"
                        onClick={(e) => {
                          e.preventDefault();
                          removeFileAt(idx);
                        }}
                      >
                        <X size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Chip>
              ))}
            </Group>
          )}

          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={onClose}
              type="button"
              aria-label="Cancel"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={loading}
              aria-label="Post status"
            >
              Post
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

import { useState, useMemo } from 'react';
import {
  Group,
  TextInput,
  ActionIcon,
  Loader,
  Select,
  Textarea,
  Button,
  Badge,
} from '@mantine/core';
import { IconSend, IconPaperclip } from '@tabler/icons-react';
import axiosClient from '../api/axiosClient';
import StickerPicker from './StickerPicker.jsx';
import FileUploader from './FileUploader.jsx';
import { toast } from '../utils/toast';

const TTL_OPTIONS = [
  { value: '0', label: 'Off' },
  { value: '10', label: '10s' },
  { value: '60', label: '1m' },
  { value: String(10 * 60), label: '10m' },
  { value: String(60 * 60), label: '1h' },
  { value: String(24 * 3600), label: '1d' },
];

export default function MessageInput({ chatroomId, currentUser, onMessageSent }) {
  const [content, setContent] = useState('');
  const [ttl, setTtl] = useState(String(currentUser?.autoDeleteSeconds || 0));

  // Files uploaded to R2
  const [uploaded, setUploaded] = useState([]);
  // Stickers / GIFs picked (no upload)
  const [inlinePicks, setInlinePicks] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [sending, setSending] = useState(false);
  const nothingToSend = useMemo(
    () => !content.trim() && uploaded.length === 0 && inlinePicks.length === 0,
    [content, uploaded.length, inlinePicks.length]
  );

  function kindFromMime(m) {
    if (!m) return 'FILE';
    if (m.startsWith('image/')) return 'IMAGE';
    if (m.startsWith('video/')) return 'VIDEO';
    if (m.startsWith('audio/')) return 'AUDIO';
    return 'FILE';
  }

  const handleSend = async (e) => {
    e?.preventDefault?.();
    if (nothingToSend || sending) return;

    setSending(true);
    const attachmentsInline = [
      ...uploaded.map((f) => ({
        kind: kindFromMime(f.contentType),
        url: f.url,
        mimeType: f.contentType,
        width: f.width || null,
        height: f.height || null,
        durationSec: f.durationSec || null,
        caption: f.caption || null,
      })),
      ...inlinePicks,
    ];

    const payload = {
      chatRoomId: String(chatroomId),
      content: content.trim() || undefined,
      expireSeconds: Number(ttl) || 0,
      attachmentsInline,
    };

    try {
      const { data: saved } = await axiosClient.post('/messages', payload, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      onMessageSent?.(saved);
      toast.ok('Message delivered.');
      setContent('');
      setUploaded([]);
      setInlinePicks([]);
    } catch (err) {
      toast.err('Failed to send. You can retry the failed bubble.');
      onMessageSent?.({
        id: `temp-${Date.now()}`,
        content: content.trim(),
        createdAt: new Date().toISOString(),
        mine: true,
        failed: true,
        expireSeconds: Number(ttl) || 0,
        attachmentsInline,
      });
      console.error('Error sending message', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSend}>
      <Group align="end" gap="xs" wrap="nowrap">
        {/* Text */}
        <TextInput
          aria-label="Message input"
          placeholder="Say something…"
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          rightSection={sending ? <Loader size="xs" /> : null}
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          style={{ flex: 1 }}
        />

        {/* TTL */}
        <Select
          value={ttl}
          onChange={setTtl}
          data={TTL_OPTIONS}
          w={110}
          aria-label="Message timer"
          disabled={sending}
        />

      <Button
        variant="light"
        onClick={() => setPickerOpen(true)}
        disabled={sending}
        type="button"
        aria-label={String.fromCodePoint(0x1F600)} 
      >
        {String.fromCodePoint(0x1F600)}
      </Button>


        {/* FileUploader (R2) */}
        <FileUploader
          button={
            <Button
              variant="light"
              leftSection={<IconPaperclip size={16} />}
              disabled={sending}
              aria-label="Attach files"
              type="button"
            >
              Attach
            </Button>
          }
          onUploaded={(fileMeta) => {
            setUploaded((prev) => [...prev, fileMeta]);
          }}
        />

        {/* Send */}
        <ActionIcon
          type="submit"
          variant="filled"
          radius="xl"
          size="lg"
          disabled={sending || nothingToSend}
          aria-label="Send message"
          title="Send (Enter)"
        >
          <IconSend size={18} />
        </ActionIcon>
      </Group>

      {/* Uploaded files with optional captions */}
      {uploaded.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {uploaded.map((f, i) => (
            <Group
              key={`${f.key}-${i}`}
              gap="xs"
              align="center"
              wrap="nowrap"
              style={{ marginBottom: 6 }}
            >
              <Badge variant="light">
                {f.contentType?.split('/')[0]?.toUpperCase() || 'FILE'}
              </Badge>

              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={f.url}
              >
                {new URL(f.url).pathname.split('/').pop()}
              </a>

              <Textarea
                placeholder="Caption (optional)"
                autosize
                minRows={1}
                maxRows={2}
                w={320}
                value={f.caption || ''}
                onChange={(e) =>
                  setUploaded((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, caption: e.currentTarget.value } : x))
                  )
                }
                aria-label={`Attachment ${i + 1} caption`}
              />

              <Button
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => setUploaded((prev) => prev.filter((_, idx) => idx !== i))}
                aria-label={`Remove attachment ${i + 1}`}
                type="button"
              >
                Remove
              </Button>
            </Group>
          ))}
        </div>
      )}

      {/* Inline stickers / GIFs preview badges */}
      {inlinePicks.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {inlinePicks.map((a, i) => (
            <span
              key={`${a.url}-${i}`}
              style={{
                display: 'inline-block',
                fontSize: 12,
                background: '#f3f3f3',
                borderRadius: 8,
                padding: '4px 8px',
                marginRight: 8,
              }}
              title={a.url}
            >
              {a.kind === 'GIF' ? 'GIF' : 'Sticker'}
            </span>
          ))}
          <Button
            size="xs"
            variant="subtle"
            color="red"
            onClick={() => setInlinePicks([])}
            style={{ marginLeft: 4 }}
            aria-label="Clear stickers and GIFs"
            type="button"
          >
            Clear
          </Button>
        </div>
      )}

      {/* Sticker / GIF picker modal */}
      <StickerPicker
        opened={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(att) => {
          setInlinePicks((prev) => [...prev, att]);
          setPickerOpen(false);
        }}
      />
    </form>
  );
}

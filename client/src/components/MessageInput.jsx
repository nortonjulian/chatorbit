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

const TTL_OPTIONS = [
  { value: '0', label: 'Off' },
  { value: '10', label: '10s' },
  { value: '60', label: '1m' },
  { value: String(10 * 60), label: '10m' },
  { value: String(60 * 60), label: '1h' },
  { value: String(24 * 3600), label: '1d' },
];

/**
 * Props:
 * - chatroomId (number|string)
 * - currentUser (object)
 * - onMessageSent (fn) — called with the newly-saved message
 */
export default function MessageInput({ chatroomId, currentUser, onMessageSent }) {
  const [content, setContent] = useState('');
  const [ttl, setTtl] = useState(String(currentUser?.autoDeleteSeconds || 0));

  // Files already uploaded to R2 via <FileUploader/>
  // Each item: { url, key, contentType, width?, height?, durationSec?, caption? }
  const [uploaded, setUploaded] = useState([]);

  // Stickers / GIFs picked from remote providers (no upload)
  // Each: { kind: 'STICKER'|'GIF', url, mimeType?, width?, height?, durationSec?, caption? }
  const [inlinePicks, setInlinePicks] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [sending, setSending] = useState(false);
  const nothingToSend = useMemo(
    () => !content.trim() && uploaded.length === 0 && inlinePicks.length === 0,
    [content, uploaded.length, inlinePicks.length]
  );

  const handleSend = async (e) => {
    e?.preventDefault?.();
    if (nothingToSend) return;

    setSending(true);
    try {
      // Compose “inline attachments” payload (server merges these with message)
      const attachmentsInline = [
        // R2 uploads
        ...uploaded.map((f) => ({
          kind: kindFromMime(f.contentType),
          url: f.url,
          mimeType: f.contentType,
          width: f.width || null,
          height: f.height || null,
          durationSec: f.durationSec || null,
          caption: f.caption || null,
        })),
        // Stickers / GIFs
        ...inlinePicks,
      ];

      const payload = {
        chatRoomId: String(chatroomId),
        content: content.trim() || undefined,
        expireSeconds: Number(ttl) || 0,
        attachmentsInline,
      };

      const { data: saved } = await axiosClient.post('/messages', payload, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      onMessageSent?.(saved);
      // reset
      setContent('');
      setUploaded([]);
      setInlinePicks([]);
    } catch (err) {
      console.error('Error sending message', err);
    } finally {
      setSending(false);
    }
  };

  function kindFromMime(m) {
    if (!m) return 'FILE';
    if (m.startsWith('image/')) return 'IMAGE';
    if (m.startsWith('video/')) return 'VIDEO';
    if (m.startsWith('audio/')) return 'AUDIO';
    return 'FILE';
  }

  return (
    <form onSubmit={handleSend}>
      <Group align="end" gap="xs" wrap="nowrap">
        {/* Text */}
        <TextInput
          style={{ flex: 1 }}
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

        {/* Sticker/GIF picker */}
        <Button variant="light" onClick={() => setPickerOpen(true)} disabled={sending}>
          😀
        </Button>

        {/* FileUploader (R2) */}
        <FileUploader
          button={
            <Button variant="light" leftSection={<IconPaperclip size={16} />} disabled={sending}>
              Attach
            </Button>
          }
          // Called when a file finishes uploading to R2
          onUploaded={(fileMeta) => {
            // fileMeta: { url, key, contentType, width?, height?, durationSec? }
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
          aria-label="Send"
        >
          <IconSend size={18} />
        </ActionIcon>
      </Group>

      {/* Uploaded files (from R2) with optional captions */}
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
                style={{
                  maxWidth: 260,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
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
              />

              <Button
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => setUploaded((prev) => prev.filter((_, idx) => idx !== i))}
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
          // att: { kind: 'STICKER'|'GIF', url, mimeType?, width?, height?, durationSec?, caption? }
          setInlinePicks((prev) => [...prev, att]);
          setPickerOpen(false);
        }}
      />
    </form>
  );
}

import { useState } from 'react';
import {
  Group,
  TextInput,
  FileInput,
  ActionIcon,
  Loader,
  Select,
  Textarea,
  Button,
} from '@mantine/core';
import { IconPaperclip, IconSend } from '@tabler/icons-react';
import axiosClient from '../api/axiosClient';
import StickerPicker from './StickerPicker.jsx';

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
 * - getLastInboundText (optional fn) — still supported but unused here
 */
export default function MessageInput({
  chatroomId,
  currentUser,
  onMessageSent,
  getLastInboundText, // kept for API compatibility
}) {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);          // File[]
  const [captions, setCaptions] = useState({});    // { [idx: number]: string }
  const [loading, setLoading] = useState(false);
  const [ttl, setTtl] = useState(String(currentUser?.autoDeleteSeconds || 0));

  // Stickers / GIFs picked from remote providers (no upload)
  // Each item: { kind: 'STICKER'|'GIF', url, mimeType?, width?, height?, durationSec?, caption? }
  const [inlineAttachments, setInlineAttachments] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const nothingToSend =
    !content.trim() && files.length === 0 && inlineAttachments.length === 0;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (nothingToSend) return;

    setLoading(true);
    try {
      const form = new FormData();
      form.append('chatRoomId', String(chatroomId));
      form.append('expireSeconds', String(Number(ttl) || 0));
      if (content.trim()) form.append('content', content.trim());

      // Append files[] for multer.array('files', 10)
      files.forEach((f) => form.append('files', f));

      // Pair meta by index
      const meta = files.map((_, i) => ({
        idx: i,
        caption: captions[i] || null,
        // width/height/durationSec can be added after client-side inspection/cropping
      }));
      form.append('attachmentsMeta', JSON.stringify(meta));

      // Inline stickers/GIFs (no upload; server will merge with uploaded attachments)
      if (inlineAttachments.length) {
        form.append('attachmentsInline', JSON.stringify(inlineAttachments));
      }

      const { data: saved } = await axiosClient.post('/messages', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onMessageSent?.(saved);

      // Reset inputs
      setContent('');
      setFiles([]);
      setCaptions({});
      setInlineAttachments([]);
    } catch (err) {
      console.error('Error sending message', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Group align="end" gap="xs" wrap="nowrap">
        {/* Text message */}
        <TextInput
          style={{ flex: 1 }}
          placeholder="Say something…"
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          rightSection={loading ? <Loader size="xs" /> : null}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        {/* TTL picker */}
        <Select
          value={ttl}
          onChange={setTtl}
          data={TTL_OPTIONS}
          w={110}
          aria-label="Message timer"
          disabled={loading}
        />

        {/* Sticker/GIF picker trigger */}
        <Button
          variant="light"
          onClick={() => setPickerOpen(true)}
          disabled={loading}
        >
          😀
        </Button>

        {/* Multi-file picker (append to list) */}
        <FileInput
          value={null} // always null so the same file can be picked again later
          onChange={(f) => f && setFiles((prev) => [...prev, f])}
          accept="image/*,video/*,audio/*"
          placeholder="Attach"
          leftSection={<IconPaperclip size={16} />}
          w={180}
          disabled={loading}
          clearable
        />

        {/* Send */}
        <ActionIcon
          type="submit"
          variant="filled"
          radius="xl"
          size="lg"
          disabled={loading || nothingToSend}
          aria-label="Send"
        >
          <IconSend size={18} />
        </ActionIcon>
      </Group>

      {/* Simple media list with per-file captions */}
      {files.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {files.map((f, i) => (
            <Group
              key={`${f.name}-${i}`}
              gap="xs"
              align="center"
              wrap="nowrap"
              style={{ marginBottom: 6 }}
            >
              <div
                style={{
                  width: 180,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={`${f.name} (${f.type || 'unknown'})`}
              >
                {f.name} <small>({f.type || 'file'})</small>
              </div>

              {/* Optional: launch an editor/cropper here, then replace file in state */}
              {/* <Button size="xs" variant="light" onClick={() => setEditorIndex(i)}>Edit</Button> */}

              <Textarea
                placeholder="Caption (optional)"
                autosize
                minRows={1}
                maxRows={2}
                w={320}
                value={captions[i] || ''}
                onChange={(e) =>
                  setCaptions((s) => ({ ...s, [i]: e.currentTarget.value }))
                }
              />

              <Button
                size="xs"
                variant="subtle"
                color="red"
                onClick={() =>
                  setFiles((prev) => prev.filter((_, idx) => idx !== i))
                }
              >
                Remove
              </Button>
            </Group>
          ))}
        </div>
      )}

      {/* Inline stickers / GIFs preview badges */}
      {inlineAttachments.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {inlineAttachments.map((a, i) => (
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
            onClick={() => setInlineAttachments([])}
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
          // Expect att: { kind: 'STICKER'|'GIF', url, mimeType?, width?, height?, durationSec?, caption? }
          setInlineAttachments((prev) => [...prev, att]);
          setPickerOpen(false);
        }}
      />

      {/*
        If you later add an ImageEditorModal/cropper:
        <ImageEditorModal
          file={files[editorIndex]}
          onCancel={() => setEditorIndex(null)}
          onSave={(blob, meta) => {
            const newFile = new File([blob], files[editorIndex].name, { type: files[editorIndex].type });
            setFiles(prev => prev.map((f, i) => i === editorIndex ? newFile : f));
            // Optionally store meta.width/height in captions/meta map by index
            setEditorIndex(null);
          }}
        />
      */}
    </form>
  );
}

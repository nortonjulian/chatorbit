import { useState, useRef } from 'react';
import { Group, TextInput, FileInput, Button, ActionIcon, Loader, Select } from '@mantine/core';
import { IconPaperclip, IconSend } from '@tabler/icons-react';
import socket from '../socket';
import axiosClient from '../api/axiosClient';
import CustomEmojiPicker from './EmojiPicker';

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
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ttl, setTtl] = useState(String(currentUser?.autoDeleteSeconds || 0)); // default from user
  const typingTimeoutRef = useRef(null);

  const handleTyping = () => {
    if (!chatroomId || !currentUser?.username) return;
    socket.emit('typing', { chatRoomId: chatroomId, username: currentUser.username });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', String(chatroomId));
    }, 2000);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!content.trim() && !file) return;

    setLoading(true);
    try {
      const expireSeconds = Number(ttl) || 0;

      // Always use HTTP for now (files must go over HTTP; this also unifies the pipeline).
      // The server route will emit the saved message to the room.
      const formData = new FormData();
      formData.append('chatRoomId', String(chatroomId));
      formData.append('expireSeconds', String(expireSeconds));
      if (content) formData.append('content', content);
      if (file) formData.append('file', file);

      const { data: newMessage } = await axiosClient.post('/messages', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Let parent append immediately; server also broadcasts to others
      onMessageSent?.(newMessage);

      // Reset inputs
      setContent('');
      setFile(null);
    } catch (err) {
      console.error('Error sending message', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Group align="end" gap="xs" wrap="nowrap">
        {/* Emoji */}
        <CustomEmojiPicker onSelect={(emoji) => setContent((v) => (v || '') + emoji)} />

        {/* Message input */}
        <TextInput
          style={{ flex: 1 }}
          placeholder="Type your message..."
          value={content}
          onChange={(e) => {
            setContent(e.currentTarget.value);
            handleTyping();
          }}
          rightSection={loading ? <Loader size="xs" /> : null}
          disabled={loading}
          onKeyDown={(e) => {
            // submit on Enter (but allow Shift+Enter if you switch to a Textarea later)
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

        {/* File picker */}
        <FileInput
          value={file}
          onChange={setFile}
          accept="image/*,video/*"
          placeholder="Attach"
          leftSection={<IconPaperclip size={16} />}
          clearable
          w={180}
          disabled={loading}
        />

        {/* Send */}
        <ActionIcon
          type="submit"
          variant="filled"
          radius="xl"
          size="lg"
          disabled={loading || (!content.trim() && !file)}
          aria-label="Send"
        >
          <IconSend size={18} />
        </ActionIcon>
      </Group>
    </form>
  );
}

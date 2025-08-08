import { useState, useRef } from 'react';
import { Group, TextInput, FileInput, Button, ActionIcon, Loader } from '@mantine/core';
import { IconPaperclip, IconSend } from '@tabler/icons-react';
import socket from '../socket';
import CustomEmojiPicker from './EmojiPicker';

export default function MessageInput({ chatroomId, currentUser, onMessageSent }) {
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const typingTimeoutRef = useRef(null);

  const handleTyping = () => {
    if (!chatroomId || !currentUser?.username) return;
    socket.emit('typing', { chatRoomId: chatroomId, username: currentUser.username });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', chatroomId);
    }, 2000);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!content.trim() && !file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('chatRoomId', chatroomId);
      if (content) formData.append('content', content);
      if (file) formData.append('file', file);

      const res = await fetch('http://localhost:5001/messages', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to send message');

      const newMessage = await res.json();
      onMessageSent?.(newMessage);
      socket.emit('send_message', newMessage);

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
            // submit on Enter (but allow Shift+Enter in case you switch to Textarea later)
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
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

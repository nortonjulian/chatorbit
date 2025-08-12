import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Box,
  Group,
  Avatar,
  Paper,
  Text,
  Button,
  Stack,
  ScrollArea,
  Title,
  Badge,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconSettings,
  IconUserPlus,
  IconInfoCircle,
  IconSearch,
  IconPhoto,
} from '@tabler/icons-react';
import MessageInput from './MessageInput';
import socket from '../lib/socket';
import { decryptFetchedMessages } from '../utils/encryptionClient';
import axiosClient from '../api/axiosClient';

// ✅ Smart Replies
import SmartReplyBar from './SmartReplyBar.jsx';
import { useSmartReplies } from '../hooks/useSmartReplies.js';

// ✅ Prefs cache (IndexedDB)
import { getPref, setPref, PREF_SMART_REPLIES } from '../utils/prefsStore';

// ✅ Local message cache for search/media
import { addMessages } from '../utils/messagesStore';

// ✅ Modals
import RoomSettingsModal from './RoomSettingsModal.jsx';
import RoomInviteModal from './RoomInviteModal.jsx';
import RoomAboutModal from './RoomAboutModal.jsx';
import RoomSearchDrawer from './RoomSearchDrawer.jsx';
import MediaGalleryModal from './MediaGalleryModal.jsx';

function getTimeLeftString(expiresAt) {
  const now = Date.now();
  const expires = new Date(expiresAt).getTime();
  const diff = expires - now;
  if (diff <= 0) return 'Expired';
  const seconds = Math.floor(diff / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins > 0 ? `${mins}m ` : ''}${secs}s`;
}

function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}

export default function ChatView({ chatroom, currentUserId, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState('');
  const [showNewMessage, setShowNewMessage] = useState(false);

  // privacy UI state
  const [reveal, setReveal] = useState(false);

  // ⚙️ Room settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ➕ Room invite modal
  const [inviteOpen, setInviteOpen] = useState(false);

  // ℹ️ About / 🔎 Search / 🖼️ Gallery
  const [aboutOpen, setAboutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const isOwnerOrAdmin =
    currentUser?.role === 'ADMIN' || currentUser?.id === chatroom?.ownerId;

  // ✅ Smart Replies toggle: init from user pref, fallback to IDB cache
  const [smartEnabled, setSmartEnabled] = useState(
    () => currentUser?.enableSmartReplies ?? false
  );

  useEffect(() => {
    (async () => {
      if (currentUser?.enableSmartReplies !== undefined) {
        const v = !!currentUser.enableSmartReplies;
        setSmartEnabled(v);
        await setPref(PREF_SMART_REPLIES, v); // mirror server → cache
      } else {
        // profile not loaded yet — preload from cache
        const cached = await getPref(PREF_SMART_REPLIES, false);
        setSmartEnabled(!!cached);
      }
    })();
  }, [currentUser?.enableSmartReplies]);

  const messagesEndRef = useRef(null);
  const scrollViewportRef = useRef(null);
  const now = useNow();

  const handleEditMessage = async (msg) => {
    const newText = prompt('Edit:', msg.rawContent || msg.content);
    if (!newText || newText === msg.rawContent) return;

    try {
      const res = await fetch(`http://localhost:5001/messages/${msg.id}/edit`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newContent: newText }),
      });
      if (!res.ok) throw new Error('Failed to edit');
      const updated = await res.json();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === updated.id ? { ...m, rawContent: newText, content: newText } : m
        )
      );
    } catch (error) {
      alert('Message edit failed');
      console.error(error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowNewMessage(false);
  };

  // Blur on unfocus (Page Visibility API)
  useEffect(() => {
    if (!currentUser?.privacyBlurOnUnfocus) return;
    const onVis = () => {
      if (document.hidden) setReveal(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [currentUser?.privacyBlurOnUnfocus]);

  // --- Main socket listeners for messages, typing, etc. ---
  useEffect(() => {
    if (!chatroom || !currentUserId) return;

    const fetchAndDecryptMessages = async () => {
      try {
        const { data } = await axiosClient.get(`/messages/${chatroom.id}`);
        const decrypted = await decryptFetchedMessages(data, currentUserId);
        setMessages(decrypted);
        addMessages(chatroom.id, decrypted).catch(() => {}); // cache locally for search/media
        setTimeout(scrollToBottom, 0);
      } catch (err) {
        console.error('Failed to fetch/decrypt messages', err);
      }
    };

    fetchAndDecryptMessages();

    socket.emit('join_room', chatroom.id);

    const handleReceiveMessage = async (data) => {
      if (data.chatRoomId === chatroom.id) {
        try {
          const decryptedArr = await decryptFetchedMessages([data], currentUserId);
          const decrypted = decryptedArr[0];

          setMessages((prev) => [...prev, decrypted]);
          addMessages(chatroom.id, [decrypted]).catch(() => {});

          const v = scrollViewportRef.current;
          if (v && v.scrollTop + v.clientHeight >= v.scrollHeight - 10) {
            scrollToBottom();
          } else {
            setShowNewMessage(true);
          }
        } catch (e) {
          console.error('Failed to decrypt incoming message', e);
          setMessages((prev) => [...prev, data]);
          setShowNewMessage(true);
        }
      }
    };

    const handleTyping = ({ username }) => setTypingUser(username);
    const handleStopTyping = () => setTypingUser('');

    socket.on('receive_message', handleReceiveMessage);
    socket.on('user_typing', handleTyping);
    socket.on('user_stopped_typing', handleStopTyping);

    return () => {
      socket.emit('leave_room', chatroom.id);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('user_typing', handleTyping);
      socket.off('user_stopped_typing', handleStopTyping);
    };
  }, [chatroom, currentUserId]);

  // --- Expired message listener (simple & isolated) ---
  useEffect(() => {
    if (!chatroom) return;

    const onExpired = ({ id }) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    };

    socket.on('message_expired', onExpired);
    return () => {
      socket.off('message_expired', onExpired);
    };
  }, [chatroom?.id]);

  // --- Copy notice listener (notify sender when someone copies) ---
  useEffect(() => {
    const onCopyNotice = ({ messageId, toUserId }) => {
      if (toUserId !== currentUserId) return;
      // Optional: toast/mark UI
    };
    socket.on('message_copy_notice', onCopyNotice);
    return () => socket.off('message_copy_notice', onCopyNotice);
  }, [currentUserId]);

  // 🔔 Real-time: when others read our messages, update UI
  useEffect(() => {
    const onRead = ({ messageId, reader }) => {
      if (!reader || reader.id === currentUserId) return; // ignore our own echo
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                readBy: Array.isArray(m.readBy)
                  ? m.readBy.some((u) => u.id === reader.id)
                    ? m.readBy
                    : [...m.readBy, reader]
                  : [reader],
              }
            : m
        )
      );
    };
    socket.on('message_read', onRead);
    return () => socket.off('message_read', onRead);
  }, [currentUserId]);

  // ✅ Batch mark inbound unread as read (runs when messages change)
  // You can later refine this to only mark visible messages via IntersectionObserver.
  useEffect(() => {
    if (!messages.length || !currentUserId || !currentUser?.showReadReceipts) return;

    const unreadInbound = messages.filter(
      (m) =>
        m.sender?.id !== currentUserId &&
        !(m.readBy?.some((u) => u.id === currentUserId))
    );

    if (!unreadInbound.length) return;

    const ids = unreadInbound.map((m) => m.id);

    // Optimistic update
    setMessages((prev) =>
      prev.map((m) =>
        ids.includes(m.id)
          ? {
              ...m,
              readBy: [
                ...(m.readBy || []),
                { id: currentUserId, username: currentUser?.username },
              ],
            }
          : m
      )
    );

    axiosClient
      .post('/messages/read-bulk', { ids })
      .catch((err) => console.error('read-bulk failed', err));
  }, [messages, currentUserId, currentUser?.showReadReceipts]);

  // ✅ Smart Replies: compute suggestions from last few decrypted turns
  const { suggestions, clear } = useSmartReplies({
    messages,
    currentUserId,
    enabled: smartEnabled,
    locale: navigator.language || 'en-US',
  });

  // ✅ Send a picked smart reply through your existing socket flow
  const sendSmartReply = (text) => {
    if (!text?.trim() || !chatroom?.id) return;
    socket.emit('send_message', { content: text, chatRoomId: chatroom.id });
    clear();
  };

  const renderReadBy = (msg) => {
    if (!currentUser?.showReadReceipts) return null;
    if (msg.sender?.id !== currentUserId) return null; // only show on our messages
    const readers = (msg.readBy || []).filter((u) => u.id !== currentUserId);
    if (!readers.length) return null;

    // show at most 3 names + "+N"
    const limit = 3;
    const shown = readers.slice(0, limit).map((u) => u.username).join(', ');
    const extra = readers.length - limit;

    return (
      <Text size="xs" mt={4} c="gray.6" ta="right" fs="italic">
        Read by: {shown}
        {extra > 0 ? ` +${extra}` : ''}
      </Text>
    );
  };

  if (!chatroom) {
    return (
      <Box p="md">
        <Title order={4} mb="xs">Select a chatroom</Title>
        <Text c="dimmed">Pick a chat on the left to get started.</Text>
      </Box>
    );
  }

  const privacyActive = Boolean(currentUser?.privacyBlurEnabled);
  const holdToReveal = Boolean(currentUser?.privacyHoldToReveal);

  return (
    <Box
      p="md"
      h="100%"
      display="flex"
      style={{ flexDirection: 'column' }}
      className={clsx(
        privacyActive && !reveal && 'privacy-blur',
        reveal && 'privacy-revealed'
      )}
      onMouseDown={holdToReveal ? () => setReveal(true) : undefined}
      onMouseUp={holdToReveal ? () => setReveal(false) : undefined}
      onMouseLeave={holdToReveal ? () => setReveal(false) : undefined}
      onTouchStart={holdToReveal ? () => setReveal(true) : undefined}
      onTouchEnd={holdToReveal ? () => setReveal(false) : undefined}
    >
      <Group mb="sm" justify="space-between">
        <Title order={4}>{chatroom?.name || 'Chat'}</Title>
        <Group gap="xs">
          {chatroom?.participants?.length > 2 && (
            <Badge variant="light" radius="sm">Group</Badge>
          )}

          {/* About */}
          <Tooltip label="About">
            <ActionIcon variant="subtle" onClick={() => setAboutOpen(true)}>
              <IconInfoCircle size={18} />
            </ActionIcon>
          </Tooltip>

          {/* Search */}
          <Tooltip label="Search">
            <ActionIcon variant="subtle" onClick={() => setSearchOpen(true)}>
              <IconSearch size={18} />
            </ActionIcon>
          </Tooltip>

          {/* Media */}
          <Tooltip label="Media">
            <ActionIcon variant="subtle" onClick={() => setGalleryOpen(true)}>
              <IconPhoto size={18} />
            </ActionIcon>
          </Tooltip>

          {/* Invite button (owner/admin only) */}
          {isOwnerOrAdmin && (
            <Tooltip label="Invite people">
              <ActionIcon variant="subtle" onClick={() => setInviteOpen(true)}>
                <IconUserPlus size={18} />
              </ActionIcon>
            </Tooltip>
          )}

          {/* Settings button (owner/admin only) */}
          {isOwnerOrAdmin && (
            <Tooltip label="Room settings">
              <ActionIcon variant="subtle" onClick={() => setSettingsOpen(true)}>
                <IconSettings size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      <ScrollArea style={{ flex: 1 }} viewportRef={scrollViewportRef} type="auto">
        <Stack gap="xs" p="xs">
          {messages.map((msg) => {
            const isCurrentUser = msg.sender?.id === currentUserId;
            const expMs = msg.expiresAt ? new Date(msg.expiresAt).getTime() - now : null;
            const fading = msg.expiresAt && expMs <= 5000;

            const bubbleProps = isCurrentUser
              ? { bg: 'orbit.6', c: 'white', ta: 'right' }
              : { bg: 'gray.2', c: 'black', ta: 'left' };

            return (
              <Group
                key={msg.id}
                justify={isCurrentUser ? 'flex-end' : 'flex-start'}
                align="flex-end"
                wrap="nowrap"
                onPointerDown={(e) => {
                  const target = e.target;
                  const timeout = setTimeout(() => {
                    if (isCurrentUser && (msg.readBy?.length || 0) === 0) handleEditMessage(msg);
                  }, 600);
                  target.onpointerup = () => clearTimeout(timeout);
                  target.onpointerleave = () => clearTimeout(timeout);
                }}
              >
                {!isCurrentUser && (
                  <Avatar
                    src={msg.sender?.avatarUrl || '/default-avatar.png'}
                    alt={msg.sender?.username || 'avatar'}
                    radius="xl"
                    size={32}
                  />
                )}

                <Paper
                  className="message-bubble"
                  px="md"
                  py="xs"
                  radius="lg"
                  withBorder={false}
                  style={{ maxWidth: 360, opacity: fading ? 0.5 : 1 }}
                  {...bubbleProps}
                >
                  {!isCurrentUser && (
                    <Text size="xs" fw={600} c="dark.6" mb={4} className="sender-name">
                      {msg.sender?.username}
                    </Text>
                  )}

                  <Text
                    size="sm"
                    onCopy={() => {
                      if (currentUser?.notifyOnCopy && socket && msg?.id) {
                        socket.emit('message_copied', { messageId: msg.id });
                      }
                    }}
                  >
                    {msg.decryptedContent || msg.translatedForMe}
                  </Text>

                  {/* 📷🖼️ Images grid */}
                  {Array.isArray(msg.attachments) &&
                    msg.attachments.some((a) => a.kind === 'IMAGE') && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: 6,
                          marginTop: 6,
                        }}
                      >
                        {msg.attachments
                          .filter((a) => a.kind === 'IMAGE')
                          .map((a) => (
                            <img
                              key={a.id}
                              src={a.url}
                              alt={a.caption || 'image'}
                              style={{
                                width: 160,
                                height: 160,
                                objectFit: 'cover',
                                borderRadius: 8,
                                cursor: 'pointer',
                              }}
                              onClick={() => {
                                // TODO: open gallery viewer at this item
                              }}
                            />
                          ))}
                      </div>
                    )}

                  {/* 🎬 Videos */}
                  {msg.attachments
                    ?.filter((a) => a.kind === 'VIDEO')
                    .map((a) => (
                      <video
                        key={a.id}
                        controls
                        preload="metadata"
                        style={{ width: 260, marginTop: 6 }}
                        src={a.url}
                      />
                    ))}

                  {/* 🎧 Audios */}
                  {msg.attachments
                    ?.filter((a) => a.kind === 'AUDIO')
                    .map((a) => (
                      <audio
                        key={a.id}
                        controls
                        preload="metadata"
                        style={{ width: 260, marginTop: 6 }}
                        src={a.url}
                      />
                    ))}

                  {/* 🎤 Legacy per-message audio */}
                  {msg.audioUrl && (
                    <audio
                      controls
                      preload="metadata"
                      style={{ width: 260, marginTop: 6 }}
                      src={msg.audioUrl}
                    />
                  )}

                  {/* 🏷️ Captions summary */}
                  {msg.attachments?.some((a) => a.caption) && (
                    <Text size="xs" mt={4}>
                      {msg.attachments
                        .map((a) => a.caption)
                        .filter(Boolean)
                        .join(' • ')}
                    </Text>
                  )}

                  {msg.translatedForMe && msg.rawContent && (
                    <Text size="xs" mt={4} fs="italic">
                      Original: {msg.rawContent}
                    </Text>
                  )}

                  {msg.expiresAt && (
                    <Text size="xs" mt={4} fs="italic" c="red.6" ta="right">
                      Disappears in: {getTimeLeftString(msg.expiresAt)}
                    </Text>
                  )}

                  {/* 🟣 Auto-reply badge (for messages generated by auto-responder) */}
                  {msg.isAutoReply && (
                    <Group justify="flex-end" mt={4}>
                      <Badge size="xs" variant="light" color="grape">
                        Auto-reply
                      </Badge>
                    </Group>
                  )}

                  {/* ✅ Read receipts (our messages only) */}
                  {renderReadBy(msg)}
                </Paper>
              </Group>
            );
          })}
          <div ref={messagesEndRef} />
        </Stack>
      </ScrollArea>

      {typingUser && (
        <Text size="sm" c="dimmed" fs="italic" mt="xs">
          {typingUser} is typing...
        </Text>
      )}

      {showNewMessage && (
        <Group justify="center" mt="xs">
          <Button onClick={scrollToBottom}>New Messages</Button>
        </Group>
      )}

      {/* ✅ Smart Replies toggle + suggestions */}
      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 12 }}>
          <input
            type="checkbox"
            checked={smartEnabled}
            onChange={(e) => {
              const v = e.target.checked;
              setSmartEnabled(v);
              setPref(PREF_SMART_REPLIES, v); // cache for next preload
            }}
          />{' '}
          Enable Smart Replies (sends last message to server for AI)
        </label>

        <SmartReplyBar
          suggestions={suggestions}
          onPick={(t) => sendSmartReply(t)}
        />
      </div>

      {chatroom && (
        <Box mt="sm">
          <MessageInput
            chatroomId={chatroom.id}
            currentUser={currentUser}
            // Optional convenience for /tr <lang> with no text
            getLastInboundText={() => {
              const lastInbound = messages
                .slice()
                .reverse()
                .find((m) => m.sender?.id !== currentUserId);
              return lastInbound?.decryptedContent || lastInbound?.content || '';
            }}
            onMessageSent={(msg) => {
              setMessages((prev) => [...prev, msg]);
              addMessages(chatroom.id, [msg]).catch(() => {});
              scrollToBottom();
            }}
          />
        </Box>
      )}

      {/* ⚙️ Room settings modal */}
      <RoomSettingsModal
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        room={chatroom}
        onUpdated={(updated) => {
          // If parent keeps chatroom in state somewhere, merge this there.
        }}
      />

      {/* ➕ Invite modal */}
      <RoomInviteModal
        opened={inviteOpen}
        onClose={() => setInviteOpen(false)}
        roomId={chatroom.id}
      />

      {/* ℹ️ About */}
      <RoomAboutModal
        opened={aboutOpen}
        onClose={() => setAboutOpen(false)}
        room={chatroom}
        onSaved={(u) => {
          // Merge room description up the tree if you hold it in state there
        }}
      />

      {/* 🔎 Local search */}
      <RoomSearchDrawer
        opened={searchOpen}
        onClose={() => setSearchOpen(false)}
        roomId={chatroom.id}
        onJump={(messageId) => {
          // Optional: implement scroll-to-message if your DOM tags messages with data-mid
        }}
      />

      {/* 🖼️ Media gallery */}
      <MediaGalleryModal
        opened={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        roomId={chatroom.id}
      />
    </Box>
  );
}

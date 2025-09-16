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
  Skeleton,
} from '@mantine/core';
import {
  IconSettings,
  IconUserPlus,
  IconInfoCircle,
  IconSearch,
  IconPhoto,
  IconClock,
  IconSparkles,
  IconRotateClockwise,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import MessageInput from './MessageInput';
import ReactionBar from './ReactionBar.jsx';
import EventSuggestionBar from './EventSuggestionBar.jsx';
import socket from '../lib/socket';
import { decryptFetchedMessages } from '../utils/encryptionClient';
import axiosClient from '../api/axiosClient';
import { toast } from '../utils/toast';

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

import { playSound } from '../lib/sounds.js';

// 🔒 Premium check
import useIsPremium from '@/hooks/useIsPremium';

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
  const [messages, setMessages] = useState([]); // oldest → newest for render
  const [typingUser, setTypingUser] = useState('');
  const [showNewMessage, setShowNewMessage] = useState(false);

  // pagination state
  const [cursor, setCursor] = useState(null); // server "nextCursor" (message id), null => no more
  const [loading, setLoading] = useState(false);

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
        const cached = await getPref(PREF_SMART_REPLIES, false);
        setSmartEnabled(!!cached);
      }
    })();
  }, [currentUser?.enableSmartReplies]);

  const messagesEndRef = useRef(null);
  const scrollViewportRef = useRef(null);
  const now = useNow();

  const navigate = useNavigate();
  const isPremium = useIsPremium();

  const handleEditMessage = async (msg) => {
    const newText = prompt('Edit:', msg.rawContent || msg.content);
    if (!newText || newText === msg.rawContent) return;

    try {
      const { data: updated } = await axiosClient.patch(`/messages/${msg.id}/edit`, {
        newContent: newText,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === updated.id
            ? { ...m, rawContent: newText, content: newText }
            : m
        )
      );
      toast.ok('Message updated.');
    } catch (error) {
      toast.err('Message edit failed.');
      console.error(error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowNewMessage(false);
  };

  // --- Pagination loader (initial + older pages) ---
  async function loadMore(initial = false) {
    if (!chatroom?.id || loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', initial ? '50' : '30');
      if (!initial && cursor) params.set('cursor', String(cursor));

      const { data } = await axiosClient.get(
        `/messages/${chatroom.id}?${params.toString()}`
      );

      // data: { items, nextCursor, count }
      const decrypted = await decryptFetchedMessages(
        data.items || [],
        currentUserId
      );

      // Server returns newest → oldest; we render oldest → newest
      const chronological = decrypted.slice().reverse();

      if (initial) {
        setMessages(chronological);
        setCursor(data.nextCursor ?? null);
        setTimeout(scrollToBottom, 0);
      } else {
        const v = scrollViewportRef.current;
        const prevHeight = v ? v.scrollHeight : 0;

        setMessages((prev) => [...chronological, ...prev]);
        setCursor(data.nextCursor ?? null);

        setTimeout(() => {
          if (!v) return;
          const newHeight = v.scrollHeight;
          v.scrollTop = newHeight - prevHeight + v.scrollTop;
        }, 0);
      }

      addMessages(chatroom.id, chronological).catch(() => {});
    } catch (err) {
      toast.err('Failed to load messages.');
      console.error('Failed to fetch/decrypt paged messages', err);
    } finally {
      setLoading(false);
    }
  }

  // --- Initial load / room change ---
  useEffect(() => {
    setMessages([]);
    setCursor(null);
    setShowNewMessage(false);
    if (chatroom?.id) {
      loadMore(true);
      // NEW: prefer bulk join event with single room for consistency
      socket.emit('join:rooms', [String(chatroom.id)]);
      // Back-compat (okay to keep during transition)
      socket.emit('join_room', chatroom.id);
    }
    return () => {
      if (chatroom?.id) socket.emit('leave_room', chatroom.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatroom?.id]);

  // --- Infinite scroll: load older when near TOP ---
  useEffect(() => {
    const v = scrollViewportRef.current;
    if (!v) return;

    const onScroll = () => {
      const nearTop = v.scrollTop <= 120;
      if (nearTop && cursor && !loading) loadMore(false);
    };

    v.addEventListener('scroll', onScroll);
    return () => v.removeEventListener('scroll', onScroll);
  }, [cursor, loading]);

  // --- Realtime: receiving new messages ---
  useEffect(() => {
    if (!chatroom || !currentUserId) return;

    const handleReceiveMessage = async (data) => {
      if (data.chatRoomId !== chatroom.id) return;
      try {
        const decryptedArr = await decryptFetchedMessages(
          [data],
          currentUserId
        );
        const decrypted = decryptedArr[0];

        setMessages((prev) => [...prev, decrypted]);
        addMessages(chatroom.id, [decrypted]).catch(() => {});

        const v = scrollViewportRef.current;
        const atBottom =
          v && v.scrollTop + v.clientHeight >= v.scrollHeight - 10;

        if (atBottom) {
          scrollToBottom();
        } else {
          setShowNewMessage(true);
        }

        const isMine = decrypted?.sender?.id === currentUserId;
        const tabHidden = document.hidden;
        if (!isMine && (!atBottom || tabHidden)) {
          playSound('/sounds/new-message.mp3', { volume: 0.6 });
        }
      } catch (e) {
        console.error('Failed to decrypt incoming message', e);
        setMessages((prev) => [...prev, data]);
        setShowNewMessage(true);

        const isMine = data?.senderId === currentUserId;
        const v = scrollViewportRef.current;
        const atBottom =
          v && v.scrollTop + v.clientHeight >= v.scrollHeight - 10;
        const tabHidden = document.hidden;
        if (!isMine && (!atBottom || tabHidden)) {
          playSound('/sounds/new-message.mp3', { volume: 0.6 });
        }
      }
    };

    const handleTyping = ({ username }) => setTypingUser(username);
    const handleStopTyping = () => setTypingUser('');

    socket.on('receive_message', handleReceiveMessage);
    socket.on('user_typing', handleTyping);
    socket.on('user_stopped_typing', handleStopTyping);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('user_typing', handleTyping);
      socket.off('user_stopped_typing', handleStopTyping);
    };
  }, [chatroom, currentUserId]);

  // --- Expired message listener ---
  useEffect(() => {
    if (!chatroom) return;
    const onExpired = ({ id }) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    };
    socket.on('message_expired', onExpired);
    return () => socket.off('message_expired', onExpired);
  }, [chatroom?.id]);

  // --- Copy notice listener ---
  useEffect(() => {
    const onCopyNotice = ({ messageId, toUserId }) => {
      if (toUserId !== currentUserId) return;
    };
    socket.on('message_copy_notice', onCopyNotice);
    return () => socket.off('message_copy_notice', onCopyNotice);
  }, [currentUserId]);

  // 🔔 Real-time: read receipts
  useEffect(() => {
    const onRead = ({ messageId, reader }) => {
      if (!reader || reader.id === currentUserId) return;
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

  // ✅ Reactions live updates
  useEffect(() => {
    const onReaction = ({ messageId, emoji, op, user, count }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const summary = { ...(m.reactionSummary || {}) };
          summary[emoji] =
            typeof count === 'number'
              ? count
              : Math.max(0, (summary[emoji] || 0) + (op === 'added' ? 1 : -1));
          const my = new Set(m.myReactions || []);
          if (user?.id === currentUserId) {
            if (op === 'added') my.add(emoji);
            else my.delete(emoji);
          }
          return {
            ...m,
            reactionSummary: summary,
            myReactions: Array.from(my),
          };
        })
      );
    };
    socket.on('reaction_updated', onReaction);
    return () => socket.off('reaction_updated', onReaction);
  }, [currentUserId]);

  // ✅ Smart Replies
  const { suggestions, clear } = useSmartReplies({
    messages,
    currentUserId,
    enabled: smartEnabled,
    locale: navigator.language || 'en-US',
  });

  const sendSmartReply = (text) => {
    if (!text?.trim() || !chatroom?.id) return;
    socket.emit('send_message', { content: text, chatRoomId: chatroom.id });
    clear();
  };

  // === Premium toolbar actions (handler-level guard) ===
  const runPowerAi = async () => {
    if (!isPremium) {
      toast.info('This feature requires Premium.');
      return navigate('/settings/upgrade');
    }
    try {
      const { data } = await axiosClient.post('/ai/power-feature', { context: [] });
      console.log('AI power result', data);
    } catch (e) {
      console.error(e);
      toast.err('Power AI failed.');
    }
  };

  const openSchedulePrompt = async () => {
    if (!isPremium) {
      toast.info('Scheduling messages is a Premium feature.');
      return navigate('/settings/upgrade');
    }
    const iso = window.prompt('Schedule time (ISO or YYYY-MM-DD HH:mm):');
    if (!iso || !chatroom?.id) return;
    let scheduledAt;
    try {
      scheduledAt = new Date(iso).toISOString();
    } catch {
      toast.err('Invalid date');
      return;
    }
    try {
      await axiosClient.post(`/messages/${chatroom.id}/schedule`, {
        content: '(scheduled message)',
        scheduledAt,
      });
      toast.ok('Scheduled ✓');
    } catch (e) {
      console.error(e);
      toast.err('Schedule failed.');
    }
  };

  // === Retry failed optimistic message ===
  async function handleRetry(failedMsg) {
    try {
      const payload = {
        chatRoomId: String(chatroom.id),
        content: failedMsg.content || failedMsg.decryptedContent || '',
        expireSeconds: failedMsg.expireSeconds || 0,
        attachmentsInline: failedMsg.attachmentsInline || [],
      };
      const { data: saved } = await axiosClient.post('/messages', payload, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      // Replace failed temp with saved
      setMessages((prev) =>
        prev.map((m) => (m.id === failedMsg.id ? { ...saved } : m))
      );
      toast.ok('Message delivered.');
    } catch (e) {
      toast.err('Still failed. Check your connection and try again.');
    }
  }

  const renderReadBy = (msg) => {
    if (!currentUser?.showReadReceipts) return null;
    if (msg.sender?.id !== currentUserId) return null;
    const readers = (msg.readBy || []).filter((u) => u.id !== currentUserId);
    if (!readers.length) return null;

    const limit = 3;
    const shown = readers
      .slice(0, limit)
      .map((u) => u.username)
      .join(', ');
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
        <Title order={4} mb="xs">
          Select a chatroom
        </Title>
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
            <Badge variant="light" radius="sm">
              Group
            </Badge>
          )}

          {/* About */}
          <Tooltip label="About">
            <ActionIcon variant="subtle" onClick={() => setAboutOpen(true)} aria-label="About">
              <IconInfoCircle size={18} />
            </ActionIcon>
          </Tooltip>

          {/* Search */}
          <Tooltip label="Search">
            <ActionIcon variant="subtle" onClick={() => setSearchOpen(true)} aria-label="Search messages">
              <IconSearch size={18} />
            </ActionIcon>
          </Tooltip>

          {/* Media */}
          <Tooltip label="Media">
            <ActionIcon variant="subtle" onClick={() => setGalleryOpen(true)} aria-label="Open media gallery">
              <IconPhoto size={18} />
            </ActionIcon>
          </Tooltip>

          {/* Invite (owner/admin) */}
          {isOwnerOrAdmin && (
            <Tooltip label="Invite people">
              <ActionIcon variant="subtle" onClick={() => setInviteOpen(true)} aria-label="Invite people">
                <IconUserPlus size={18} />
              </ActionIcon>
            </Tooltip>
          )}

          {/* Settings (owner/admin) */}
          {isOwnerOrAdmin && (
            <Tooltip label="Room settings">
              <ActionIcon
                variant="subtle"
                onClick={() => setSettingsOpen(true)}
                aria-label="Room settings"
              >
                <IconSettings size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      <ScrollArea style={{ flex: 1 }} viewportRef={scrollViewportRef} type="auto">
        <Stack gap="xs" p="xs">
          {/* Initial skeleton while loading first page */}
          {loading && messages.length === 0 && (
            <>
              {Array.from({ length: 8 }).map((_, i) => (
                <Group key={i} justify={i % 2 ? 'flex-end' : 'flex-start'} align="flex-end">
                  <Skeleton height={18} width={i % 2 ? 220 : 280} radius="lg" />
                </Group>
              ))}
            </>
          )}

          {/* Empty state (after load) */}
          {!loading && messages.length === 0 && (
            <Text c="dimmed" ta="center" py="md">Say hello 👋</Text>
          )}

          {messages.map((msg) => {
            const isCurrentUser = msg.sender?.id === currentUserId;
            const expMs = msg.expiresAt
              ? new Date(msg.expiresAt).getTime() - now
              : null;
            const fading = msg.expiresAt && expMs <= 5000;

            // Use your theme color here; fallback to Mantine blue if custom not present
            const bubbleProps = isCurrentUser
              ? { bg: 'blue.6', c: 'white', ta: 'right' } // was orbitBlue.6 if you set custom theme
              : { bg: 'gray.2', c: 'black', ta: 'left' };

            const ts = dayjs(msg.createdAt || msg.sentAt || msg.created_at).format('MMM D, YYYY • h:mm A');

            return (
              <Group
                key={msg.id}
                justify={isCurrentUser ? 'flex-end' : 'flex-start'}
                align="flex-end"
                wrap="nowrap"
                onPointerDown={(e) => {
                  const target = e.target;
                  const timeout = setTimeout(() => {
                    if (isCurrentUser && (msg.readBy?.length || 0) === 0)
                      handleEditMessage(msg);
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

                <Tooltip label={ts} withinPortal>
                  <Paper
                    className="message-bubble"
                    px="md"
                    py="xs"
                    radius="lg"
                    withBorder={false}
                    style={{ maxWidth: 360, opacity: fading ? 0.5 : 1 }}
                    {...bubbleProps}
                    aria-label={`Message sent ${ts}`}
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
                      {msg.decryptedContent || msg.translatedForMe || msg.content}
                    </Text>

                    {/* Images */}
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
                                key={a.id || a.url}
                                src={a.url}
                                alt={a.caption || 'image'}
                                style={{
                                  width: 160,
                                  height: 160,
                                  objectFit: 'cover',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                }}
                                onClick={() => {}}
                              />
                            ))}
                        </div>
                      )}

                    {/* Videos */}
                    {msg.attachments
                      ?.filter((a) => a.kind === 'VIDEO')
                      .map((a) => (
                        <video key={a.id || a.url} controls preload="metadata" style={{ width: 260, marginTop: 6 }} src={a.url} />
                      ))}

                    {/* Audios */}
                    {msg.attachments
                      ?.filter((a) => a.kind === 'AUDIO')
                      .map((a) => (
                        <audio key={a.id || a.url} controls preload="metadata" style={{ width: 260, marginTop: 6 }} src={a.url} />
                      ))}

                    {/* Legacy per-message audio */}
                    {msg.audioUrl && (
                      <audio controls preload="metadata" style={{ width: 260, marginTop: 6 }} src={msg.audioUrl} />
                    )}

                    {/* Captions summary */}
                    {msg.attachments?.some((a) => a.caption) && (
                      <Text size="xs" mt={4}>
                        {msg.attachments.map((a) => a.caption).filter(Boolean).join(' • ')}
                      </Text>
                    )}

                    {/* Reactions */}
                    <ReactionBar message={msg} currentUserId={currentUserId} />

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

                    {msg.isAutoReply && (
                      <Group justify="flex-end" mt={4}>
                        <Badge size="xs" variant="light" color="grape">
                          Auto-reply
                        </Badge>
                      </Group>
                    )}

                    {renderReadBy(msg)}
                  </Paper>
                </Tooltip>

                {/* Retry icon for failed optimistic messages */}
                {msg.failed && (
                  <Tooltip label="Retry send">
                    <ActionIcon
                      variant="subtle"
                      aria-label="Retry sending message"
                      onClick={() => handleRetry(msg)}
                    >
                      <IconRotateClockwise size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            );
          })}
          <div ref={messagesEndRef} />
        </Stack>
      </ScrollArea>

      {typingUser && (
        <Text size="sm" c="dimmed" fs="italic" mt="xs" aria-live="polite">
          {typingUser} is typing...
        </Text>
      )}

      {showNewMessage && (
        <Group justify="center" mt="xs">
          <Button onClick={scrollToBottom} aria-label="Jump to newest">New Messages</Button>
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
              setPref(PREF_SMART_REPLIES, v);
            }}
          />{' '}
          Enable Smart Replies (sends last message to server for AI)
        </label>

        <SmartReplyBar suggestions={suggestions} onPick={(t) => sendSmartReply(t)} />
      </div>

      {/* 📅 Calendar suggestion bar */}
      <EventSuggestionBar messages={messages} currentUser={currentUser} chatroom={chatroom} />

      {/* === Premium toolbar just above the composer (visible to everyone; guarded on click) === */}
      <Group mt="sm" justify="space-between">
        <Group gap="xs">
          <Button leftSection={<IconSparkles size={16} />} onClick={runPowerAi} aria-label="Run AI Power Feature">
            Run AI Power Feature
          </Button>
          {!isPremium && <Badge size="sm" variant="light" color="yellow">Premium</Badge>}
        </Group>

        <Group gap="xs">
          <Button variant="light" leftSection={<IconClock size={16} />} onClick={openSchedulePrompt} aria-label="Schedule message">
            Schedule Send
          </Button>
          {!isPremium && <Badge size="sm" variant="light" color="yellow">Premium</Badge>}
        </Group>
      </Group>

      {chatroom && (
        <Box mt="sm">
          <MessageInput
            chatroomId={chatroom.id}
            currentUser={currentUser}
            getLastInboundText={() => {
              const lastInbound = messages.slice().reverse().find((m) => m.sender?.id !== currentUserId);
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

      {/* Modals & drawers */}
      <RoomSettingsModal opened={settingsOpen} onClose={() => setSettingsOpen(false)} room={chatroom} />
      <RoomInviteModal opened={inviteOpen} onClose={() => setInviteOpen(false)} roomId={chatroom.id} />
      <RoomAboutModal opened={aboutOpen} onClose={() => setAboutOpen(false)} room={chatroom} />
      <RoomSearchDrawer opened={searchOpen} onClose={() => setSearchOpen(false)} roomId={chatroom.id} />
      <MediaGalleryModal opened={galleryOpen} onClose={() => setGalleryOpen(false)} roomId={chatroom.id} />
    </Box>
  );
}

import { useEffect, useRef, useState } from 'react';
import MessageInput from './MessageInput';
import socket from '../socket';
import { decryptFetchedMessages } from '../utils/encryptionClient'; 

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

function ChatView({ chatroom, currentUserId, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState('');
  const [showNewMessage, setShowNewMessage] = useState(false);
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const now = useNow();

  const handleEditMessage = async (msg) => {
    const newText = prompt('Edit:', msg.rawContent || msg.content);
    if (!newText || newText === msg.rawContent) return;

    try {
      const res = await fetch(`http://localhost:5001/messages/${msg.id}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: currentUserId, newContent: newText }),
      });

      if (!res.ok) throw new Error('Failed to edit');

      const updated = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? { ...m, rawContent: newText, content: newText } : m))
      );
    } catch (error) {
      alert('Message edit failed');
      console.log(error);
    }
  };

  useEffect(() => {
    if (!chatroom || !currentUserId) return;

    const fetchAndDecryptMessages = async () => {
      try {
        const res = await fetch(`http://localhost:5001/messages/${chatroom.id}?userId=${currentUserId}`);
        const data = await res.json();
        const decrypted = await decryptFetchedMessages(data, currentUserId);
        setMessages(decrypted);
      } catch (err) {
        console.error('Failed to fetch/decrypt messages', err);
      }
    };

    fetchAndDecryptMessages();

    socket.emit('join_room', chatroom.id);

    const handleReceiveMessage = (data) => {
      if (data.chatRoomId === chatroom.id) {
        setMessages((prev) => [...prev, data]);

        if (
          containerRef.current &&
          containerRef.current.scrollTop + containerRef.current.clientHeight >=
            containerRef.current.scrollHeight - 10
        ) {
          scrollToBottom();
        } else {
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

  useEffect(() => {
    if (!messages.length || !currentUserId || !currentUser?.showReadReceipts) return;

    const unreadMessages = messages.filter(
      (msg) =>
        msg.sender?.id !== currentUserId &&
        !(msg.readBy?.some((u) => u.id === currentUserId))
    );

    unreadMessages.forEach((msg) => {
      fetch(`http://localhost:5001/messages/${msg.id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).catch((err) => console.error(`Failed to mark message ${msg.id} as read`, err));
    });
  }, [messages, currentUserId, currentUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowNewMessage(false);
  };

  return (
    <div className="p-4 w-2/3 flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-2">
        {chatroom?.name || 'Select a chatroom'}
      </h2>

      <div className="space-y-2 flex-1 overflow-y-auto border rounded p-2" ref={containerRef}>
        {messages.map((msg) => {
          const isCurrentUser = msg.sender?.id === currentUserId;
          const timeLeft = msg.expiresAt ? new Date(msg.expiresAt).getTime() - now : null;

          return (
            <div
              key={msg.id}
              className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
              onPointerDown={(e) => {
                const timeout = setTimeout(() => {
                  if (isCurrentUser && msg.readBy?.length === 0) handleEditMessage(msg);
                }, 600);
                e.target.onpointerup = () => clearTimeout(timeout);
                e.target.onpointerleave = () => clearTimeout(timeout);
              }}
            >
              {!isCurrentUser && (
                <div className="flex items-start space-x-2">
                  {msg.sender?.avatarUrl ? (
                    <img
                      src={msg.sender.avatarUrl}
                      alt="avatar"
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <img
                      src="/default-avatar.png"
                      alt="default avatar"
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  )}
                </div>
              )}

              <div
                className={`max-w-xs p-2 rounded-lg ${
                  isCurrentUser ? 'bg-blue-500 text-white text-right' : 'bg-gray-200 text-black text-left'
                } ${msg.expiresAt && timeLeft <= 5000 ? 'opacity-50' : 'opacity-100'}`}
              >
                {!isCurrentUser && (
                  <div className="text-sm font-medium text-gray-800 mb-1">
                    {msg.sender?.username}
                  </div>
                )}
                {msg.content}

                {msg.translatedContent && msg.rawContent && (
                  <div className="text-xs text-yellow-100 mt-1 italic">
                    Original: {msg.rawContent}
                  </div>
                )}

                {msg.expiresAt && (
                  <div className="text-xs mt-1 italic text-red-500 text-right">
                    Disappears in: {getTimeLeftString(msg.expiresAt, now)}
                  </div>
                )}

                {isCurrentUser &&
                  msg.readBy?.length > 0 &&
                  currentUser?.showReadReceipts && (
                    <div className="text-xs text-gray-300 mt-1 text-right italic">
                      Read by: {msg.readBy.map((u) => u.username).join(', ')}
                    </div>
                  )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {typingUser && (
        <div className="text-sm text-gray-500 italic mt-1">{typingUser} is typing...</div>
      )}

      {showNewMessage && (
        <button
          className="bg-blue-500 text-white px-3 py-1 rounded mt-2"
          onClick={scrollToBottom}
        >
          New Messages
        </button>
      )}

      {chatroom && (
        <MessageInput
          chatroomId={chatroom.id}
          onMessageSent={(msg) => {
            setMessages((prev) => [...prev, msg]);
            scrollToBottom();
          }}
        />
      )}
    </div>
  );
}

export default ChatView;

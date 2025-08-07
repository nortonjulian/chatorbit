import { useEffect, useState, useRef } from 'react';
import socket from '../socket';
import axiosClient from '../api/axiosClient';

export default function RandomChat({ currentUser }) {
  const [roomId, setRoomId] = useState(null);
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('Searching...');
  const [offerAI, setOfferAI] = useState(false)
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket.emit('find_random_chat', currentUser.username);

    socket.on('waiting', (msg) => setStatus(msg));

    socket.on('no_partner', ({ message}) => {
        setStatus(message);
        setOfferAI(true)
    })

    socket.on('pair_found', ({ roomId, partner }) => {
      setRoomId(roomId);
      setPartner(partner);
      setStatus(`Connected to ${partner}`);
      setMessages([]);
    });

    socket.on('chat_skipped', (msg) => {
      setStatus(msg);
      setRoomId(null);
      setPartner(null);
    });

    socket.on('partner_disconnected', (msg) => {
      setStatus(msg);
      setRoomId(null);
      setPartner(null);
      setOfferAI(false)
    });

    socket.on('receive_message', (msg) => {
      if (msg.randomChatRoomId === roomId) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    return () => {
      socket.off('waiting');
      socket.off('no_partner')
      socket.off('pair_found');
      socket.off('chat_skipped');
      socket.off('partner_disconnected');
      socket.off('receive_message');
    };
  }, [currentUser.username, roomId]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg = {
      content: input,
      senderId: currentUser.id,
      chatRoomId: roomId,
      randomChatRoomId: roomId,
    };
    socket.emit('send_message', newMsg);
    setMessages((prev) => [...prev, { ...newMsg, sender: currentUser }]);
    setInput('');
  };

  const handleSkip = () => {
    socket.emit('skip_random_chat');
    setMessages([]);
    setPartner(null);
    setRoomId(null);
    setOfferAI(false)
  };

  const handleSave = async () => {
    try {
      await axiosClient.post('/random-chats', {
        messages: messages.map((m) => ({
          content: m.content,
          senderId: m.senderId,
        })),
        participants: [currentUser.id], // partner ID will be fetched dynamically
      });
      alert('Chat saved!');
    } catch (error) {
      console.error('Error saving chat:', error);
      alert('Failed to save chat');
    }
  };

  const handleStartAI = () => {
    socket.emit('start_ai_chat', currentUser.username);
    setStatus('Connected to OrbitBot');
    setOfferAI(false);
    setRoomId(`random-${socket.id}-AI`);
    setMessages([]);
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full p-4 border rounded shadow">
      <h2 className="text-lg font-bold">Random Chat</h2>
      <p className="text-sm text-gray-500">{status}</p>

      {offerAI && (
        <button
          onClick={handleStartAI}
          className="bg-purple-500 text-white px-4 py-2 rounded mt-2"
        >
          Chat with OrbitBot
        </button>
      )}

      <div className="flex-1 overflow-y-auto my-4 space-y-2">
        {messages.map((m, i) => {
          const isMe = m.senderId === currentUser.id;
          return (
            <div
              key={i}
              className={`p-2 rounded-lg max-w-xs ${
                isMe ? 'bg-blue-500 text-white ml-auto' : 'bg-gray-200 text-black'
              }`}
            >
              <strong>{isMe ? 'You' : m.sender?.username || partner || 'OrbitBot'}:</strong>{' '}
              {m.content}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {roomId && (
        <div className="flex space-x-2">
          <input
            className="flex-grow border rounded px-3 py-2"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button onClick={handleSend} className="bg-blue-500 text-white px-4 rounded">
            Send
          </button>
          <button onClick={handleSkip} className="bg-yellow-500 text-white px-4 rounded">
            Skip
          </button>
          <button onClick={handleSave} className="bg-green-500 text-white px-4 rounded">
            Save
          </button>
        </div>
      )}
    </div>
  );
}
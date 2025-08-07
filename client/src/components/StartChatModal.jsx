import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient'; // adjust if your structure is different
import ContactList from './ContactList';

function StartChatModal({ currentUserId, onClose }) {
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  const handleStart = async () => {
    if (!username) return;

    try {
      const userRes = await axiosClient.get(`/users/search`, {
        params: { query: username }
      });

      const targetUser = userRes.data;
      if (!targetUser || targetUser.id === currentUserId) {
        alert('User not found or cannot chat with yourself.');
        return;
      }

      const chatRes = await axiosClient.post(`/chatrooms/direct/${targetUser.id}`);
      const chatroom = chatRes.data;

      onClose();
      navigate(`/chat/${chatroom.id}`);
    } catch (err) {
      console.error('Failed to start chat:', err);
      alert('Failed to start chat.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white p-4 rounded w-full max-w-md">
        <h2 className="text-lg font-semibold mb-3">Start a New Chat</h2>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Search by username or phone"
          className="w-full border px-2 py-1 rounded mb-3"
        />
        <button
          onClick={handleStart}
          className="bg-blue-600 text-white px-4 py-1 rounded"
        >
          Start Chat
        </button>

        <hr className="my-4" />

        <ContactList currentUserId={currentUserId} />

        <button onClick={onClose} className="mt-4 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

export default StartChatModal;

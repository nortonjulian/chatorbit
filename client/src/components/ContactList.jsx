// components/ContactList.jsx
import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useNavigate } from 'react-router-dom';

function ContactList({ currentUserId }) {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await axiosClient.get(`/contacts/${currentUserId}`);
        setContacts(res.data);
      } catch (err) {
        console.error('Failed to fetch contacts:', err);
      }
    };
    fetchContacts();
  }, [currentUserId]);

  const filtered = contacts.filter(c =>
    (c.alias || c.user.username).toLowerCase().includes(search.toLowerCase())
  );

  const startChat = (userId) => {
    // Navigate to chat screen with selected contact (adjust route as needed)
    navigate(`/chat/${userId}`);
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-lg font-semibold mb-2">Saved Contacts</h2>
      <input
        type="text"
        placeholder="Search contacts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-3 px-2 py-1 border rounded"
      />
      <ul className="space-y-2">
        {filtered.map((c) => (
          <li
            key={c.userId}
            className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded cursor-pointer hover:bg-gray-200"
            onClick={() => startChat(c.userId)}
          >
            <span>{c.alias || c.user.username}</span>
            <span className="text-sm text-gray-500">Chat →</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ContactList;

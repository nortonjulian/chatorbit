// components/SaveContactButton.jsx
import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

function SaveContactButton({ currentUserId, otherUserId }) {
  const [isSaved, setIsSaved] = useState(false);
  const [alias, setAlias] = useState('');
  const [showAliasInput, setShowAliasInput] = useState(false);

  useEffect(() => {
    const checkContact = async () => {
      try {
        const res = await axiosClient.get(`/contacts/${currentUserId}`);
        const found = res.data.find(c => c.userId === otherUserId);
        if (found) {
          setIsSaved(true);
          setAlias(found.alias || '');
        }
      } catch (err) {
        console.error('Failed to check contact:', err);
      }
    };
    checkContact();
  }, [currentUserId, otherUserId]);

  const saveContact = async () => {
    try {
      await axiosClient.post('/contacts', {
        ownerId: currentUserId,
        userId: otherUserId,
        alias,
      });
      setIsSaved(true);
      setShowAliasInput(false);
    } catch (err) {
      console.error('Failed to save contact:', err);
    }
  };

  if (isSaved) return <span className="text-green-600 text-sm">✓ Saved</span>;

  return (
    <div className="ml-2">
      {showAliasInput ? (
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Alias (optional)"
            className="px-1 py-0.5 border rounded text-sm"
          />
          <button
            onClick={saveContact}
            className="text-sm bg-blue-500 text-white px-2 py-1 rounded"
          >
            Save
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAliasInput(true)}
          className="text-sm text-blue-600 underline"
        >
          Save Contact
        </button>
      )}
    </div>
  );
}

export default SaveContactButton;

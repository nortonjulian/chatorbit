// components/Sidebar.jsx

import { Plus, Users, Settings } from 'lucide-react';
import { useState } from 'react';
import StartChatModal from './StartChatModal';
import UsersList from './UsersList';
import ChatroomList from './ChatroomList';

function Sidebar({ currentUser, setSelectedRoom }) {
  const [showStartModal, setShowStartModal] = useState(false);

  return (
    <div className="w-72 bg-gray-100 h-screen flex flex-col justify-between p-4 border-r">
      {/* Top icons */}
      <div className="flex justify-between mb-4">
        <button onClick={() => setShowStartModal(true)}>
          <Plus className="w-6 h-6 text-gray-700" />
        </button>
        <button>
          <Users className="w-6 h-6 text-gray-700" />
        </button>
        <button>
          <Settings className="w-6 h-6 text-gray-700" />
        </button>
      </div>

      {/* Main sidebar content */}
      <div className="flex-1 overflow-y-auto space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">Users</h2>
          <UsersList currentUser={currentUser} />
        </div>

        <div>
          <h2 className="text-lg font-semibold mt-6 mb-2">Chatrooms</h2>
          <ChatroomList currentUser={currentUser} onSelect={setSelectedRoom} />
        </div>
      </div>

      {/* Modal */}
      {showStartModal && (
        <StartChatModal
          currentUserId={currentUser.id}
          onClose={() => setShowStartModal(false)}
        />
      )}
    </div>
  );
}

export default Sidebar;

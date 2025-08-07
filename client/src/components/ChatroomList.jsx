import { useEffect, useState } from 'react'
import { fetchChatrooms } from '../api/chatrooms';
import socket from '../socket';

function ChatroomList({ onSelect, currentUser, selectedRoom }) {
    const [chatrooms, setChatrooms] = useState([])

    useEffect(() => {
        const loadChatrooms = async () => {
            if (!currentUser?.id) return;
            const rooms = await fetchChatrooms(currentUser.id)
            setChatrooms(rooms)
        }

        loadChatrooms();
    }, [currentUser]);

    const handleSelect = (room) => {
        if (selectedRoom?.id) {
            socket.emit('leave_room', selectedRoom.id)
        }
        socket.emit('join_room', room.id)
        onSelect(room)
    }

    return (
        <div className="p-4 border-r w-1/3 bg-gray-50">
          <h2 className="text-xl font-semibold mb-4">Chatrooms</h2>
          <ul className="space-y-2">
            {chatrooms.map((room) => {
              const isSelected = selectedRoom?.id === room.id
              const roomName = room.name || `Room #${room.id}`
    
              return (
                <li
                  key={room.id}
                  onClick={() => handleSelect(room)}
                  className={`cursor-pointer p-2 rounded ${
                    isSelected ? 'bg-blue-100 font-semibold' : 'hover:bg-gray-100'
                  }`}
                >
                  {roomName}
                  {room.participants?.length > 2 && (
                    <span className="text-xs text-gray-500 ml-2">(Group)</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
    )
}

export default ChatroomList
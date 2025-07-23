import { useEffect, useState } from 'react'
import { fetchChatrooms } from '../api/chatrooms';

function ChatroomList({ onSelect, currentUser }) {
    const [chatrooms, setChatrooms] = useState([])

    useEffect(() => {
        const loadChatrooms = async () => {
            if (!currentUser?.id) return;
            const rooms = await fetchChatrooms(currentUser.id)
            setChatrooms(rooms)
        }

        loadChatrooms();
    }, [currentUser]);

    return (
        <div className="p-4 border-r w-1/3">
            <h2 className="text-xl font-semibold mb-4">Chatrooms</h2>
            <ul className="space-y-2">
                {chatrooms.map((room) => (
                    <li
                        key={room.id}
                        onClick={() => onSelect(room)}
                        className="cursor-pointer hover:underline"
                    >
                        {room.name || `Room #${room.id}`}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default ChatroomList
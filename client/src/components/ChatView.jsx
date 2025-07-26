import { useEffect, useState } from 'react'
import MessageInput from './MessageInput'
import socket from '../socket'

function ChatView({ chatroom, currentUserId }) {
    const [messages, setMessages] = useState([])

    useEffect(() => {
        if (!chatroom || !currentUserId) return

        fetch(`http://localhost:5001/messages/${chatroom.id}?userId=${currentUserId}`)
            .then(res => res.json())
            .then(data => setMessages(data))
            .catch(err => console.log(err))

        socket.emit('join_room', chatroom.id)

        const handleReceiveMessage = (data) => {
            if (data.chatroomId === chatroom.id) {
                setMessages(prev => [...prev.data])
            }
        }

        socket.on('receive_message', handleReceiveMessage)

        return () => {
            socket.emit('leave_room', chatroom.id)
            socket.emit('receive_message', handleReceiveMessage)
        }
    }, [chatroom, currentUserId])

    const handleNewMessage = (newMessage) => {
        setMessages((prevMessages) => [...prevMessages, newMessage])
    }

    return (
        <div className="p-4 w-2/3">
            <h2 className="text-xl font-semibold mb-2">
                {chatroom?.name || 'Select a chatroom'}
            </h2>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {messages.map((msg) => (
                    <div key={msg.id} className="p-2 bg-gray-100 rounded">
                        <strong>{msg.sender?.username || 'Unknown'}:</strong> {msg.content}
                            {msg.rawContent && (
                                <div className="text-sm text-red-600 mt-1 italic">
                                Raw: {msg.rawContent}
                            </div>
                            )}      
                    </div>
                ))}
            </div>
            {chatroom && (
                <MessageInput chatroomId={chatroom.id} onMessageSent={handleNewMessage} />
            )}
        </div>
    )
}

export default ChatView
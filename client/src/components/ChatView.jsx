import { useEffect, useState } from 'react'
import MessageInput from './MessageInput'

function ChatView({ chatroom }) {
    const [messages, setMessages] = useState([])

    useEffect(() => {
        if (!chatroom) return

        fetch(`http://localhost:5001/messages/${chatroom.id}`)
            .then(res => res.json())
            .then(data => setMessages(data))
            .catch(err => console.log(err))
    }, [chatroom])

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
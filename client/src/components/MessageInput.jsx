import { useState } from 'react'
import socket from '../socket'

function MessageInput({ chatroomId, onMessageSent }) {
    const [content, setContent] = useState('')
    const [file, setFile] = useState(null)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!content.trim()) return

        setLoading(true)

        try {
            const formData = new FormData()
            formData.append('chatRoomId', chatroomId)
            formData.append('content', content)
            if (file) {
                formData.append('file', file)
            }

            const res = await fetch('http://localhost:5001/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: formData,
            }) 

            if (res.ok) {
                const newMessage = await res.json()
                onMessageSent(newMessage)
                socket.emit('send_message', newMessage)
                setContent('')
                setFile(null)
            } else {
                console.log('Failed to send message')
            }
        } catch (error) {
            console.log('FError sending message', error)  
        }

        setLoading(false)
    } 

    return (
        <form onSubmit={handleSubmit} className="flex space-x-2 mt-4">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your message..."
              className="flex-grow border rounded px-3 py-2"
              disabled={loading}
            />
            <input
               type="file"
               onChange={(e) => setFile(e.target.files[0])}
               accept="image/*,video/*"
               className="text-sm"
            />   
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
            >
                Send
            </button>
        </form>
    )
}

export default MessageInput
import { useState, useRef } from 'react'
import socket from '../socket'

function MessageInput({ chatroomId, currentUser, onMessageSent }) {
  const [content, setContent] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const typingTimeoutRef = useRef(null)

  const handleTyping = () => {
    if (!chatroomId || !currentUser?.username) return

    socket.emit('typing', { chatRoomId: chatroomId, username: currentUser.username })

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', chatroomId)
    }, 2000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim() && !file) return

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('chatRoomId', chatroomId)
      if (content) formData.append('content', content)
      if (file) formData.append('file', file)

      const res = await fetch('http://localhost:5001/messages', {
        method: 'POST',
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
      console.log('Error sending message', error)
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex space-x-2 mt-4">
      <input
        type="text"
        value={content}
        onChange={(e) => {
          setContent(e.target.value)
          handleTyping()
        }}
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
        disabled={loading || (!content.trim() && !file)}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        Send
      </button>
    </form>
  )
}

export default MessageInput

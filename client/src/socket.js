import { io } from 'socket.io-client'

const token = localStorage.getItem('token')

const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001', {
    autoConnect: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    auth: token ? { token } : {},
});

socket.on('connect', () => {
    console.log(`🟢 Connected to Socket.IO server (id: ${socket.id})`)
})

socket.on('disconnect', (reason) => {
    console.warn(`🔴 Disconnected from server: ${reason}`)
})

socket.on('connect', (err) => {
    console.log('Socket connection error:', err.message)
})

export default socket;
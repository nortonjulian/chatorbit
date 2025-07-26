import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

import usersRouter from './routes/users.js'
import chatroomsRouter from './routes/chatrooms.js'
import messagesRouter from './routes/messages.js'

import authRouter from './routes/auth.js'

dotenv.config()

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 5001

// HTTP server for Socket.IO
const server = http.createServer(app)

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
})

// Middleware
app.use(cors())
app.use(express.json())

// Base route
app.get('/', (req, res) => {
  res.send('Welcome to ChatOrbit API!')
})

// Get all users
app.use('/users', usersRouter)
app.use('/chatrooms', chatroomsRouter)
app.use('/messages', messagesRouter)

app.use('auth', authRouter)

io.on('connection', (socket) => {
  console.log(`🟢 User connected: ${socket.id}`)

  socket.on('send_message', async (messageData) => {
     const { content, senderId, chatRoomId } = messageData

     try {
       const savedMessage = await prisma.message.create({
          data: {
            content,
            senderId,
            chatRoomId,
          },
          include: {
            sender: true,
          }
       })
       // ✅ Emit saved message to all clients
       io.emit('receive_message', savedMessage)
     } catch (error) {
        console.log('Error saving message:', error)
     }
  })

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected: ${socket.id}')
  })
})

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
})

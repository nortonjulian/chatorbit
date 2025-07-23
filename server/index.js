import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

import usersRouter from './routes/users.js'
import chatroomsRouter from './routes/chatrooms.js'
import messagesRouter from './routes/messages.js'

dotenv.config()

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 5001

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
})

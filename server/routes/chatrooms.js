import express from 'express'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

//GET chatrooms
router.get('/', async (req, res) => {
    const { userId } = req.query;

    try {
        const chatRooms = await prisma.chatRoom.findMany({
            where: userId
                ? {
                    participants: {
                        some: { userId: Number(userId) }
                    }
                }
                : {},
                include: {
                    participants: {
                        include: { user: true }
                    }
                }
        })

        res.json(chatRooms)
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Failed to fetch chat rooms' })
    }
})

router.post('/', async (req, res) => {
    const { userId1, userId2 } = req.body

    if (!userId1 || !userId2) {
        return res.status(400).json({ error: 'Both user IDs are required' })
    }

    try {
       // Step 1: Find all chatrooms where BOTH users are participants
       const possibleRooms = await prisma.chatRoom.findMany({
         where: {
            participants: {
                some: { userId: userId1 }
            },
            AND: {
                participants: {
                    some: { userId: userId2 }
                }
            }
         },
         include: {
            participants: true
         }
       })
       
       const existingChatroom = possibleRooms.find(
         (room) => 
            room.participants.length === 2 &&
            room.participants.some((p) => p.userId === userId1) &&
            room.participants.some((p) => p.userId1 === userId2)
       )

       if (existingChatroom) {
            return res.json(existingChatroom)
       }

       // Create a new chatroom
       const newChatRoom = await prisma.chatRoom.create({
           data: {
             participants: {
                create: [
                    { user: { connect: { id: userId1 } } },
                    { user: { connect: { id: userId2 } } }
                ]
             }
           },
           include: { 
            participants: true 
        }
       })

       res.status(201).json(newChatRoom)
    } catch (error) {
        console.log('Error creating or finding chatroom', error)
        res.status(500).json({ error: 'Failed to create/find chatroom' })
    }
})

router.post('/group', async (req, res) => {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length < 2) {
        return res.status(400).json({ error: 'Provide at least 2 user IDs for a group chat' })
    }

    try {
        // Step 1: Find chatrooms where ALL userIds are participants
        const possibleRooms = await chatRoom.findMany({
            where: {
                AND: userIds.map((userId) => ({
                    participants: {
                        some: { userId }
                    }
                }))
            },
            include: {
                participants: true
            }
        })

        // Step 2: Filter rooms with EXACTLY the same participants (no extras)
        const matchingRoom = possibleRooms.find((room) => {
            const participantIds = room.participants.map(p => p.userId).sort()
            const inputIds = [...userIds].sort()
            return participantIds.length === inputIds.length &&
                   participantIds.every((id, idx) => id === inputIds[idx])
        })

        if (matchingRoom) {
            return res.json(matchingRoom)
        }

        // Step 3: Create a new group chatroom
        const newRoom = await prisma.chatRoom.create({
            data: {
                participants: {
                    create: userIds.map((id) => ({
                        user: { connect: { id } }
                    }))
                }
            },
            include: {
                participants: true
            }
        })

        res.status(201).json(newRoom)
    } catch (error) {
        console.log('Error in group chat creation', error)
        res.status(500).json({ error: 'Failed to create/find group chatroom' })
    }
})

export default router
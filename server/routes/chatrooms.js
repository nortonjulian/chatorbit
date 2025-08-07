import express from 'express'
import { PrismaClient } from '@prisma/client'
import { verifyToken } from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

//GET chatrooms
router.get('/', verifyToken, async (req, res) => {
    const { userId } = req.query;

    try {
        const chatRooms = await prisma.chatRoom.findMany({
            where: userId
                ? {
                    participants: { some: { userId: Number(userId) } } }
                : {},
                include: {
                    participants: {
                        include: { user: true }
                    },
                },
                orderBy: { updatedAt: 'desc' },
        })

        res.json(chatRooms)
    } catch (error) {
        console.log('Error fetching chatrooms', error)
        res.status(500).json({ error: 'Failed to fetch chat rooms' })
    }
})

router.post('/direct/:targetUserId', verifyToken, async (req, res) => {
    const userId1 = req.user.id;
    const userId2 = parseInt(req.params.targetUserId, 10);

    if (!userId1 || !userId2 || userId1 === userId2) {
        return res.status(400).json({ error: 'Invalid or duplicate user IDs' });
    }

    try {
        const existingRoom = await prisma.chatRoom.findFirst({
            where: {
                isGroup: false,
                participants: {
                    every: {
                        OR: [
                            { userId: userId1 },
                            { userId: userId2 }
                        ]
                    }
                }
            },
            include: { participants: true }
        });

        if (existingRoom) return res.json(existingRoom);

        const newChatRoom = await prisma.chatRoom.create({
            data: {
                isGroup: false,
                participants: {
                    create: [
                        { user: { connect: { id: userId1 } } },
                        { user: { connect: { id: userId2 } } }
                    ]
                }
            },
            include: { participants: true }
        });

        res.status(201).json(newChatRoom);
    } catch (error) {
        console.log('Error creating or finding chatroom', error);
        res.status(500).json({ error: 'Failed to create/find chatroom' });
    }
});

router.post('/group', verifyToken, async (req, res) => {
    const { userIds, name } = req.body;

    if (!Array.isArray(userIds) || userIds.length < 2) {
        return res.status(400).json({ error: 'Provide at least 2 user IDs for a group chat' })
    }

    try {
        // Step 1: Find chatrooms where ALL userIds are participants
        const possibleRooms = await prisma.chatRoom.findMany({
            where: {
                isGroup: true,
                participants: {
                    every: { userId: { in: userIds.map(Number) } },
                },
            },
            include: { participants: true }
        })

        // Step 2: Filter rooms with EXACTLY the same participants (no extras)
        const matchingRoom = possibleRooms.find((room) => {
            const ids = room.participants.map(p => p.userId).sort()
            const targetIds = [...userIds].map(Number).sort()
            return ids.length === targetIds.length &&
                   ids.every((id, idx) => id === targetIds[idx])
        })

        if (matchingRoom) {
            return res.json(matchingRoom)
        }

        // Step 3: Create a new group chatroom
        const newRoom = await prisma.chatRoom.create({
            data: {
                name: name || 'Group chat',
                isGroup: true,
                participants: {
                    create: userIds.map((id) => ({
                        user: { connect: { id: Number(id) } },
                    })),
                },
            },
            include: { participants: true }
        })

        res.status(201).json(newRoom)
    } catch (error) {
        console.log('Error in group chat creation', error)
        res.status(500).json({ error: 'Failed to create/find group chatroom' })
    }
})

router.get('/:id/public-keys', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const participants = await prisma.participant.findMany({
            where: { chatRoomId: Number(id) },
            include: {
                user: {
                    select: {
                        id: true,
                        publicKey: true,
                        username: true,
                    },
                },
            },
        })

        const keys = participants.map((p) => p,user)
        res.json(keys)
    } catch (error) {
        console.log('Failed to fetch participant keys', error)
        res.status(500).json({ error: 'Failed to fetch keys' })
    }
})

export default router
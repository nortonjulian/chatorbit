import express from 'express'
import { PrismaClient } from '@prisma/client'
import { translateMessageIfNeeded } from '../utils/translate'
import { isExplicit, cleanText } from '../utils/filterExplicitContent.js';

const router = express.Router()
const prisma = new PrismaClient()


router.post('/', async (req, res) => {
    const { content, senderId, chatRoomId } = req.body;

    if (!content || !senderId || !chatRoomId) {
        return res.status(400).json({ error: 'Missing required fields' })
    }

    try {
        const sender = await prisma.user.findUnique({ where: { id: senderId } })
        if (!sender) return res.status(404).json({ error: 'Sender not found' })

        const participants = await prisma.participant.findMany({
            where: { chatRoomId },
            include: { user: true }
        })

        const senderLang = sender.preferredLanguage || 'en';

        const explicit = isExplicit(content);

        const requiresClean = !sender.allowExplicit || participants.some(p => !p.user.allowExplicit)
        const cleanContent = requiresClean ? cleanText(content) : content

        const translatedContent = await translateMessageIfNeeded(cleanContent, sender, participants)

        const message = await prisma.message.create({
            data: {
                content,
                translatedContent,
                translatedFrom: senderLang,
                translatedTo: translatedContent ? '...fill dynamically if needed...': null,
                isExplicit: explicit,
                sender: { connect: { id: senderId } },
                chatRoom: { connect: { id: chatRoomId } },
            },
            include: {
                sender: {
                    select: { id: true, username: true },
                },
            },
        })

        res.status(201).json(message)
    } catch (error) {
        console.log('Error creating message:', error)
        res.status(500).json({ error: 'Failed to create message' })
    }
})

//GET messages
router.get('/:chatRoomId', async (req, res) => {
    const { chatRoomId } = req.params

    try {
        const messages = await prisma.message.findMany({
            where: { chatRoomId: parseInt(chatRoomId) },
            include: {
                sender: {
                    select: { id: true, username: true },
                },
            },
            orderBy: {
                createdAt: 'asc',
            },
        })

        res.json(messages)
    } catch (error) {
        console.log('Error fetching messages', error)
        res.status(500).json({ error: 'Failed to fetch messages' })
    }
})

export default router
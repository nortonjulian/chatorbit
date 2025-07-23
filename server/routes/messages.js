import express from 'express'
import { PrismaClient } from '@prisma/client'
import { translateMessageIfNeeded } from '../utils/translate.js'
import { isExplicit, cleanText } from '../utils/filterContent.js';

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

        let finalTranslatedContent = translatedContent;
        const recipients = participants.filter(p => p.user.id !== sender.id)

        const anyReceiverDisallowsExplicit = recipients.some(p => !p.user.allowExplicit);

        if (anyReceiverDisallowsExplicit && isExplicit(translatedContent)) {
            finalTranslatedContent = '[Message removed due to explicit content]'
        }

        const message = await prisma.message.create({
            data: {
                content: cleanContent,
                rawContent: content,
                translatedContent: finalTranslatedContent,
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
    const { userId } = req.query;
    const requesterId = parseInt(userId)

    try {
        const requester = await prisma.user.findUnique({
            where: { id: requesterId },
            select: {id: true, role: true},
        })

        const messages = await prisma.message.findMany({
            where: { chatRoomId: parseInt(chatRoomId) },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                content: true,
                translatedContent: true,
                createdAt: true,
                sender: {
                    select: { id: true, username: true }
                },
                rawContent: true,
            },
        })

        const safeMessages = messages.map(msg => {
            const isSender = msg.sender.id === requesterId;
            if (isSender || isAdmin) return msg;
            const { rawContent, ...rest } = msg;
            return rest;
        })

        res.json(safeMessages)
    } catch (error) {
        console.log('Error fetching messages', error)
        res.status(500).json({ error: 'Failed to fetch messages' })
    }
})

export default router
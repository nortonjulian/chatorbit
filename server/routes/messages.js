import express from 'express'
import { PrismaClient } from '@prisma/client'
import prisma from '../utils/prismaClient.js'
import multer from 'multer'
import { verifyToken } from '../middleware/auth.js'; 
import { audit } from '../middleware/audit.js';
import { createMessageService } from '../services/messageService.js';

const router = express.Router()

const upload = multer({ dest: 'uploads/' })

router.post('/', verifyToken, upload.single('file'), async (req, res) => {
    const { content, chatRoomId } = req.body;
    const senderId = req.user.id
    const file = req.file;

    if (!content && file) {
        return res.status(400).json({ error: 'Message must include text or file' })
    }

    if (!senderId && !chatRoomId) {
        return res.status(400).json({ error: 'Missing senderId or chatRoomId' })
    }

    try {
        // const sender = await prisma.user.findUnique({ where: { id: Number(senderId) } })

        // const membership = await prisma.participant.findFirst({
        //     where: { chatRoomId: Number(chatRoomId), userId: senderId }
        // });
        // if (!membership) return res.status(403).json({ error: 'Not a participant in this chat' });
        
        // let expiresAt = null;
        // if(sender.autoDeleteSeconds) {
        //     expiresAt = new Date(Date.now() + sender.autoDeleteSeconds * 1000);
        // }
        // if (!sender) return res.status(404).json({ error: 'Sender not found' })

        // const participants = await prisma.participant.findMany({
        //     where: { chatRoomId: Number(chatRoomId) },
        //     include: { user: true }
        // })

        // const senderLang = sender.preferredLanguage || 'en';

        // const explicit = content ? isExplicit(content) : false;

        // const requiresClean = !sender.allowExplicitContent || participants.some(p => !p.user.allowExplicitContent)
        // const cleanContent = content && requiresClean ? cleanText(content) : content

        // const translationResult = content ? await translateMessageIfNeeded(cleanContent, sender, participants) 
        //                         : { translatedText: null, targetLang: null}

        // let finalTranslatedContent = translationResult.translatedText;
        // const recipients = participants.filter(p => p.user.id !== sender.id)

        // const anyReceiverDisallowsExplicit = recipients.some(p => !p.user.allowExplicitContent);

        // if (anyReceiverDisallowsExplicit && finalTranslatedContent && isExplicit(translatedContent)) {
        //     finalTranslatedContent = '[Message removed due to explicit content]'
        // }

        //     // Encrypt the message for all participants (AES-GCM + NaCl for session keys)
        // const recipientUsers = participants.map(p => p.user); // includes sender
        // const { ciphertext, encryptedKeys } = await encryptMessageForParticipants(
        // cleanContent || '',
        // sender,
        // recipientUsers
        // );

        const fileUrl = file ? `/uploads/${file.filename}` : null;
        // const message = await prisma.message.create({
        //     data: {
        //         contentCiphertext: ciphertext,
        //         encryptedKeys,
        //         rawContent: content || null,
        //         translatedContent: finalTranslatedContent,
        //         translatedFrom: senderLang,
        //         translatedTo: translationResult.targetLang, 
        //         isExplicit: explicit,
        //         imageUrl: file ? `/uploads/${file.filename}` : null,
        //         expiresAt,
        //         sender: { connect: { id: Number(senderId) } },
        //         chatRoom: { connect: { id: Number(chatRoomId) } },
        //     },
        //     include: {
        //         sender: {
        //             select: { id: true, username: true, publicKey: true },
        //         },
        //     },
        // })
        const message = await createMessageService({
            senderId,
            chatRoomId,
            content,
            fileUrl
        })

        res.status(201).json(message)
    } catch (error) {
        const status = error.statusCode || 500;
        console.log('Error creating message:', error)
        res.status(status).json({ error: 'Failed to create message' })
    }
})

//GET messages
router.get('/:chatRoomId', verifyToken, async (req, res) => {
    const chatRoomId = Number(req.params.chatRoomId)
    const requesterId = req.user.id
    const isAdmin = req.user.role === 'ADMIN'

    try {
        if (!isAdmin) {
            const membership = await prisma.participant.findFirst({
                where: { chatRoomId, userId: requesterId }
            });
            if (!membership) return res.status(403).json({ error: 'Forbidden' });
        }

        const messages = await prisma.message.findMany({
            where: { chatRoomId },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                contentCiphertext: true,
                encryptedKeys: true,
                translatedContent: true,
                imageUrl: true,
                createdAt: true,
                sender: {
                    select: { id: true, username: true }
                },
                rawContent: true,
                deletedBySender: true,
            },
        })

        const safeMessages = messages
            .filter(msg => {
                // Don't show messages deleted by sender to that sender
                if (msg.deletedBySender && msg.sender.id === requesterId) return false;
                return true;
            })
            .map(msg => {
                const isSender = requesterId && msg.sender.id === requesterId;
                if (isSender || isAdmin) return msg;
                const { rawContent, ...rest } = msg;
                return rest;
            });


        res.json(safeMessages)
    } catch (error) {
        console.log('Error fetching messages', error)
        res.status(500).json({ error: 'Failed to fetch messages' })
    }
})

// PATCH /messages/:id/read
router.patch('/:id/read', verifyToken, async (req, res) => {
    const messageId = Number(req.params.id);
    const userId = req.user.id;
  
    try {
      const updated = await prisma.message.update({
        where: { id: messageId },
        data: {
          readBy: {
            connect: { id: userId }
          }
        },
      });
  
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to mark message as read', error);
      res.status(500).json({ error: 'Could not mark message as read' });
    }
  });

router.patch('/:id/edit', verifyToken, async (req, res) => {
    const messageId = parseInt(req.params.id);
    const requesterId = req.user.id
    const { newContent } = req.body;

    try {
        const message = await prisma.message.findUnique({
            where: { id: messageId },
            include: {
              sender: true,
              chatRoom: { include: { participants: { include: { user: true } } } },
            },
          });
      
          if (!message || message.sender.id !== requesterId|| message.readBy?.length > 0) {
            return res.status(403).json({ error: 'Unauthorized or already read' });
          }

        const { ciphertext, encryptedKeys } = await encryptMessageForParticipants(
            newContent,
            message.sender,
            message.chatRoom.participants.map((p) => p.user)
        );

        const { translatedText, targetLang } = await translateMessageIfNeeded(
            newContent,
            message.sender,
            message.chatRoom.participants
        )

        const updated = await prisma.message.update({
            where: { id: messageId },
            data: {
                rawContent: newContent,
                contentCiphertext: ciphertext,
                encryptedKeys,
                translatedContent: translatedText,
                translatedTo: targetLang, 
            },
            include : {
                sender: { select: { id: true, username: true } },
            },
        })

        res.json(updated)
    } catch (error) {
        console.log('Failed to edit message', error)
        res.status(500).json({ error: 'Edit failed' })
    }
})  

router.delete('/:id', verifyToken, audit('messages.delete', {
    resource: 'message',
    resourceId: (req) => req.params.id
  }), async (req, res) => {
    const messageId = parseInt(req.params.id);
    const requesterId = parseInt(req.userId, 10);
    const isAdmin = req.user.role === 'ADMIN';

    try {
        const message = await prisma.message.findUnique({
            where: { id: messageId },
            select: { senderId: true },
        })

        if (!message || (!isAdmin && message.senderId !== requesterId)) {
            return res.status(400).json({ error: 'Unauthorized to delete this message' })
        }

        await prisma.message.update({
            where: { id: messageId },
            data: { deletedBySender: true },
        })

        res.json({ success: true })
    } catch (error) {
        console.log('Failed to delete message', error);
        res.status(500).json({ error: 'Failed to delete message' })
    }
})

// POST - Report a message (user forwards decrypted content to admin)
router.post('/report', async (req, res) => {
    const { messageId, reporterId, decryptedContent} = req.body;
    if (!messageId || !reporterId || !decryptedContent) {
        return res.status(400).json({ error: 'Missing required fields' })
    }

    try {
        await prisma.report.create({
            data: {
                messageId: Number(messageId),
                reporterId: Number(reporterId),
                decryptedContent,
            }
        })
        res.status(201).json({ success: true })
    } catch (error) {
        console.log('Error reporting messages', error)
        res.status(500).json({ error: 'Failed to report message' })
    }
})

export default router
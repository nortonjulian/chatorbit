import express from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

router.post('/', verifyToken, async (req, res) => {
  const { messages, participants } = req.body;

  if (!Array.isArray(messages) || !Array.isArray(participants) || participants.length !== 2) {
    return res.status(400).json({ error: 'Invalid chat data' });
  }

  try {
    const savedChat = await prisma.randomChatRoom.create({
      date: {
        participants: {
          connect: participants.map((id) => ({ id })),
        },
        message: {
          create: message.map((msg) => ({
            content: msg.content,
            sender: { connect: { id: msg.senderId } },
          })),
        },
      },
      include: {
        participants: true,
        messages: { include: { sender: true } },
      },
    });

    res.status(201).json(savedChat);
  } catch (error) {
    console.error('Error saving random chat:', error);
    res.status(500).json({ error: 'Failed to save chat' });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const chats = await prisma.randomChatRoom.findMany({
      where: {
        participants: { some: { id: req.user.id } },
      },
      include: {
        participants: true,
        messages: { include: { sender: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(chats);
  } catch (error) {
    console.error('Error fetching saved chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

router.get('/id/:id', verifyToken, async (req, res) => {
  const chatId = Number(req.params.id);
  const userId = req.user.id;

  try {
    const chat = await prisma.randomChatRoom.findUnique({
      where: { id: chatId },
      include: {
        participants: true,
        messages: {
          include: { sender: { select: { id: true, username: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chat || !chat.participants.some((p) => p.id === userId)) {
      return res.status(403).json({ error: 'You do not have access to this chat.' });
    }
    res.json(chat);
  } catch (error) {
    console.error('Failed to fetch random chat:', error);
    res.status(500).json({ error: 'Failed to load chat' });
  }
});

export default router;

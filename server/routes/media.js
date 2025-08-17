import express from 'express';
import prisma from '../utils/prismaClient.js';
import { requireAuth } from '../middleware/auth.js';

const media = express.Router();

media.get('/chatrooms/:id/media', requireAuth, async (req, res) => {
  const chatRoomId = Number(req.params.id);
  const userId = req.user.id;

  // membership gate
  const member = await prisma.participant.findFirst({
    where: { chatRoomId, userId },
  });
  if (!member && req.user.role !== 'ADMIN')
    return res.status(403).json({ error: 'Forbidden' });

  const rows = await prisma.messageAttachment.findMany({
    where: { message: { chatRoomId } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      kind: true,
      url: true,
      mimeType: true,
      width: true,
      height: true,
      durationSec: true,
      caption: true,
      createdAt: true,
      message: {
        select: {
          id: true,
          createdAt: true,
          sender: { select: { id: true, username: true, avatarUrl: true } },
        },
      },
    },
  });

  res.json(rows);
});

export default media;

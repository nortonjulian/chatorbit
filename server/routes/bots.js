import express from 'express';
import prisma from '../utils/prismaClient.js';
import { requireAuth } from '../middleware/auth.js';
import { verifySignature } from '../utils/botSign.js';
import { createMessageService } from '../services/messageService.js';

const router = express.Router();

// --- Admin guard ---
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admins only' });
  }
  next();
}

/**
 * POST /bots
 * Body: { name, url, secret, ownerId?, createServiceUser? }
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { name, url, secret, ownerId, createServiceUser = true } = req.body || {};
  if (!name || !url || !secret)
    return res.status(400).json({ error: 'name, url, secret required' });

  let serviceUserId = null;
  if (createServiceUser) {
    const user = await prisma.user.create({
      data: {
        username: name,
        role: 'BOT', // If your enum lacks BOT, you can use 'USER' and hide from normal UIs
        allowExplicitContent: true,
      },
      select: { id: true },
    });
    serviceUserId = user.id;
  }

  const bot = await prisma.bot.create({
    data: {
      ownerId: Number(ownerId) || req.user.id,
      name,
      url,
      secret,
      serviceUserId,
    },
  });

  res.status(201).json(bot);
});

/**
 * POST /bots/:id/install
 * Body: { chatRoomId, contentScope }  // COMMANDS|MENTIONS|ALL
 */
router.post('/:id/install', requireAuth, requireAdmin, async (req, res) => {
  const botId = Number(req.params.id);
  const { chatRoomId, contentScope = 'COMMANDS' } = req.body || {};
  if (!botId || !chatRoomId) return res.status(400).json({ error: 'botId & chatRoomId required' });

  const inst = await prisma.botInstall.create({
    data: { botId, chatRoomId: Number(chatRoomId), contentScope },
    include: { bot: true },
  });
  res.status(201).json(inst);
});

/**
 * PATCH /bots/installs/:installId
 * Body: { isEnabled?, contentScope? }
 */
router.patch('/installs/:installId', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.installId);
  const { isEnabled, contentScope } = req.body || {};
  const inst = await prisma.botInstall.update({
    where: { id },
    data: {
      ...(typeof isEnabled === 'boolean' ? { isEnabled } : {}),
      ...(contentScope ? { contentScope } : {}),
    },
  });
  res.json(inst);
});

/**
 * POST /bots/:installId/reply
 * Headers:
 *  - X-ChatOrbit-Timestamp
 *  - X-ChatOrbit-Signature: sha256=...
 * Body: { content, attachments? }
 */
router.post('/:installId/reply', async (req, res) => {
  const installId = Number(req.params.installId);
  const ts = req.headers['x-chatorbit-timestamp'];
  const sig = req.headers['x-chatorbit-signature'];

  try {
    const inst = await prisma.botInstall.findUnique({
      where: { id: installId },
      include: { bot: true, chatRoom: { select: { id: true } } },
    });
    if (!inst?.bot) return res.status(404).json({ error: 'install not found' });
    if (!inst.isEnabled) return res.status(403).json({ error: 'install disabled' });

    const bodyString = JSON.stringify(req.body || {});
    const ok = verifySignature(
      inst.bot.secret,
      ts,
      bodyString,
      sig,
      Number(process.env.BOT_TOLERANCE_SECONDS || 300)
    );
    if (!ok) return res.status(401).json({ error: 'invalid signature' });

    const senderId = inst.bot.serviceUserId || Number(process.env.ORBIT_BOT_USER_ID || 0);
    if (!senderId) return res.status(400).json({ error: 'bot service user not configured' });

    const { content, attachments = [] } = req.body || {};
    if (!content && !attachments.length) {
      return res.status(400).json({ error: 'content or attachments required' });
    }

    const msg = await createMessageService({
      senderId,
      chatRoomId: inst.chatRoomId,
      content,
      attachments,
    });

    // broadcast to room
    req.app.get('io')?.to(String(inst.chatRoomId)).emit('receive_message', msg);

    res.status(201).json(msg);
  } catch (e) {
    console.error('bot reply error', e);
    res.status(500).json({ error: 'bot reply failed' });
  }
});

export default router;

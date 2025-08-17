import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import asyncHandler from 'express-async-handler';

const router = express.Router();
const prisma = new PrismaClient();

const normalizePhone = (s) => (s || '').toString().replace(/[^\d+]/g, '');

// GET /contacts  -> all contacts for the authed user (both linked + external)
// server/routes/contacts.js (example)
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Math.min(Math.max(1, limitRaw), 100);
    const cursorId = req.query.cursor ? Number(req.query.cursor) : null;

    const where = {}; // add search filters if needed

    const items = await prisma.user.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: { id: true, username: true, avatarUrl: true },
    });

    const nextCursor = items.length === limit ? items[items.length - 1].id : null;
    res.json({ items, nextCursor, count: items.length });
  })
);

// POST /contacts  -> create or update (upsert) a contact
// Accepts either { userId } OR { externalPhone }, with optional { alias, externalName, favorite }
router.post('/', requireAuth, async (req, res) => {
  try {
    const ownerId = req.user.id;
    let { userId, alias, externalPhone, externalName, favorite } = req.body;

    if (!userId && !externalPhone) {
      return res.status(400).json({ error: 'Provide userId or externalPhone' });
    }

    let contact;
    if (userId) {
      contact = await prisma.contact.upsert({
        where: { ownerId_userId: { ownerId, userId: Number(userId) } },
        update: { alias: alias ?? undefined, favorite: favorite ?? undefined },
        create: {
          ownerId,
          userId: Number(userId),
          alias: alias ?? undefined,
          favorite: !!favorite,
        },
        include: { user: true },
      });
    } else {
      externalPhone = normalizePhone(externalPhone);
      contact = await prisma.contact.upsert({
        where: { ownerId_externalPhone: { ownerId, externalPhone } },
        update: {
          alias: alias ?? undefined,
          externalName: externalName ?? undefined,
          favorite: favorite ?? undefined,
        },
        create: {
          ownerId,
          externalPhone,
          externalName: externalName ?? null,
          alias: alias ?? undefined,
          favorite: !!favorite,
        },
        include: { user: true },
      });
    }

    res.status(201).json(contact);
  } catch (err) {
    console.error('Error creating/upserting contact:', err);
    res.status(500).json({ error: 'Failed to save contact' });
  }
});

// PATCH /contacts  -> update by composite key (userId or externalPhone)
router.patch('/', requireAuth, async (req, res) => {
  try {
    const ownerId = req.user.id;
    let { userId, externalPhone, alias, externalName, favorite } = req.body;

    if (!userId && !externalPhone) {
      return res.status(400).json({ error: 'Provide userId or externalPhone' });
    }

    const where = userId
      ? { ownerId_userId: { ownerId, userId: Number(userId) } }
      : { ownerId_externalPhone: { ownerId, externalPhone: normalizePhone(externalPhone) } };

    const updated = await prisma.contact.update({
      where,
      data: {
        alias: alias ?? undefined,
        externalName: externalName ?? undefined,
        favorite: favorite ?? undefined,
      },
      include: { user: true },
    });

    res.json(updated);
  } catch (err) {
    console.error('Error updating contact:', err);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE /contacts  -> delete by composite key (userId or externalPhone)
router.delete('/', requireAuth, async (req, res) => {
  try {
    const ownerId = req.user.id;
    let { userId, externalPhone } = req.body;

    if (!userId && !externalPhone) {
      return res.status(400).json({ error: 'Provide userId or externalPhone' });
    }

    const where = userId
      ? { ownerId_userId: { ownerId, userId: Number(userId) } }
      : { ownerId_externalPhone: { ownerId, externalPhone: normalizePhone(externalPhone) } };

    await prisma.contact.delete({ where });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting contact:', err);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// (Optional legacy) DELETE /contacts/:id by numeric contact id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await prisma.contact.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting contact by id:', err);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

export default router;

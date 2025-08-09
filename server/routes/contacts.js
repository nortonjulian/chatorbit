import express from 'express';
import { PrismaClient } from '@prisma/client';
import verifyToken from '../middleware/verifyToken.js';

const router = express.Router();
const prisma = new PrismaClient();

const normalizePhone = (s) =>
  (s || '').toString().replace(/[^\d+]/g, '');

// GET /contacts  -> all contacts for the authed user (both linked + external)
router.get('/', verifyToken, async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: { ownerId: req.user.id },
      include: {
        user: { select: { id: true, username: true, email: true, phoneNumber: true } },
      },
      orderBy: [{ favorite: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(contacts);
  } catch (err) {
    console.error('Error fetching contacts:', err);
    res.status(500).json({ error: 'Failed to load contacts' });
  }
});

// POST /contacts  -> create or update (upsert) a contact
// Accepts either { userId } OR { externalPhone }, with optional { alias, externalName, favorite }
router.post('/', verifyToken, async (req, res) => {
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
        create: { ownerId, userId: Number(userId), alias: alias ?? undefined, favorite: !!favorite },
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
router.patch('/', verifyToken, async (req, res) => {
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
router.delete('/', verifyToken, async (req, res) => {
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
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await prisma.contact.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting contact by id:', err);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

export default router;

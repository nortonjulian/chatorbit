import express from 'express';
import { PrismaClient } from '@prisma/client';
import verifyToken from '../middleware/verifyToken.js'; // if you're using auth middleware

const router = express.Router();
const prisma = new PrismaClient();

// GET: Fetch all contacts for the current user
router.get('/', verifyToken, async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: { ownerId: req.user.id },
      include: { user: { select: { id: true, username: true } } },
    });
    res.json(contacts);
  } catch (err) {
    console.error('Error fetching contacts:', err);
    res.status(500).json({ error: 'Failed to load contacts' });
  }
});

// POST: Save a new contact
router.post('/', verifyToken, async (req, res) => {
  const { userId, alias } = req.body;

  try {
    const contact = await prisma.contact.create({
      data: {
        ownerId: req.user.id,
        userId: Number(userId),
        alias,
      },
    });
    res.status(201).json(contact);
  } catch (err) {
    console.error('Error creating contact:', err);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// DELETE: Remove a contact
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await prisma.contact.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting contact:', err);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

export default router;

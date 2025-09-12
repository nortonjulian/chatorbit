import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import asyncHandler from 'express-async-handler';

import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();
const router = express.Router();

const normalizePhone = (s) => (s || '').toString().replace(/[^\d+]/g, '');

// ------------------------------
// GET /contacts
// Lists ONLY the authed user's contacts (internal + external)
// Supports pagination (?limit=, ?cursor=contactId) and search (?q=)
//   - search matches alias, externalName, externalPhone (digits only), and linked user's username/displayName
// Response: { items: [...], nextCursor, count }
// ------------------------------
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ownerId = req.user.id;

    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Math.min(Math.max(1, limitRaw), 100);

    const cursorId = req.query.cursor ? Number(req.query.cursor) : null;

    const q = (req.query.q || '').toString().trim();
    const qDigits = normalizePhone(q);

    const where = {
      ownerId,
      ...(q
        ? {
            OR: [
              { alias: { contains: q, mode: 'insensitive' } },
              { externalName: { contains: q, mode: 'insensitive' } },
              ...(qDigits
                ? [{ externalPhone: { contains: qDigits } }]
                : []),
              {
                user: {
                  OR: [
                    { username: { contains: q, mode: 'insensitive' } },
                    { displayName: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const items = await prisma.contact.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: {
        id: true,
        alias: true,
        favorite: true,
        externalPhone: true,
        externalName: true,
        createdAt: true,
        userId: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const nextCursor = items.length === limit ? items[items.length - 1].id : null;
    res.json({ items, nextCursor, count: items.length });
  })
);

// ------------------------------
// POST /contacts
// Upsert a contact for the authed user by either { userId } OR { externalPhone }
// Optional: { alias, externalName, favorite }
// Enforces uniqueness via composite keys (ownerId,userId) and (ownerId,externalPhone)
// ------------------------------
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ownerId = req.user.id;
    let { userId, alias, externalPhone, externalName, favorite } = req.body;

    if (!userId && !externalPhone) {
      return res.status(400).json({ error: 'Provide userId or externalPhone' });
    }

    let contact;
    if (userId) {
      contact = await prisma.contact.upsert({
        where: { ownerId_userId: { ownerId, userId: Number(userId) } },
        update: {
          alias: alias ?? undefined,
          favorite: typeof favorite === 'boolean' ? favorite : undefined,
        },
        create: {
          ownerId,
          userId: Number(userId),
          alias: alias ?? undefined,
          favorite: !!favorite,
        },
        select: {
          id: true,
          alias: true,
          favorite: true,
          externalPhone: true,
          externalName: true,
          createdAt: true,
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });
    } else {
      externalPhone = normalizePhone(externalPhone);
      if (!externalPhone) {
        return res.status(400).json({ error: 'externalPhone invalid' });
      }

      contact = await prisma.contact.upsert({
        where: { ownerId_externalPhone: { ownerId, externalPhone } },
        update: {
          alias: alias ?? undefined,
          externalName: externalName ?? undefined,
          favorite: typeof favorite === 'boolean' ? favorite : undefined,
        },
        create: {
          ownerId,
          externalPhone,
          externalName: externalName ?? null,
          alias: alias ?? undefined,
          favorite: !!favorite,
        },
        select: {
          id: true,
          alias: true,
          favorite: true,
          externalPhone: true,
          externalName: true,
          createdAt: true,
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });
    }

    res.status(201).json(contact);
  })
);

// ------------------------------
// PATCH /contacts
// Update by composite key (userId or externalPhone)
// ------------------------------
router.patch(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ownerId = req.user.id;
    let { userId, externalPhone, alias, externalName, favorite } = req.body;

    if (!userId && !externalPhone) {
      return res.status(400).json({ error: 'Provide userId or externalPhone' });
    }

    const where = userId
      ? { ownerId_userId: { ownerId, userId: Number(userId) } }
      : {
          ownerId_externalPhone: {
            ownerId,
            externalPhone: normalizePhone(externalPhone),
          },
        };

    const updated = await prisma.contact.update({
      where,
      data: {
        alias: alias ?? undefined,
        externalName: externalName ?? undefined,
        favorite: typeof favorite === 'boolean' ? favorite : undefined,
      },
      select: {
        id: true,
        alias: true,
        favorite: true,
        externalPhone: true,
        externalName: true,
        createdAt: true,
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    res.json(updated);
  })
);

// ------------------------------
// DELETE /contacts
// Delete by composite key (userId or externalPhone)
// ------------------------------
router.delete(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ownerId = req.user.id;
    let { userId, externalPhone } = req.body;

    if (!userId && !externalPhone) {
      return res.status(400).json({ error: 'Provide userId or externalPhone' });
    }

    const where = userId
      ? { ownerId_userId: { ownerId, userId: Number(userId) } }
      : {
          ownerId_externalPhone: {
            ownerId,
            externalPhone: normalizePhone(externalPhone),
          },
        };

    await prisma.contact.delete({ where });
    res.json({ success: true });
  })
);

// (Optional legacy) DELETE /contacts/:id by numeric contact id (owner-scoped hardening)
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const contactId = Number(req.params.id);
    const ownerId = req.user.id;

    // ensure the contact belongs to the requester
    const c = await prisma.contact.findUnique({ where: { id: contactId }, select: { ownerId: true } });
    if (!c || c.ownerId !== ownerId) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    await prisma.contact.delete({ where: { id: contactId } });
    res.json({ success: true });
  })
);

export default router;

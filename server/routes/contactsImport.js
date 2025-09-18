import express from 'express';
import { z } from 'zod';
import prisma from '../utils/prismaClient.js';
import { requireAuth } from '../middleware/auth.js';
import { limiterGenericMutations as mediumLimiter } from '../middleware/rateLimits.js';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const router = express.Router();

const ContactInput = z.object({
  name: z.string().trim().optional(),
  phones: z.array(z.string().trim()).optional(),
  emails: z.array(z.string().toLowerCase().trim().email()).optional(),
  alias: z.string().trim().optional(),
});

const ImportBody = z.object({
  defaultCountry: z.string().length(2).optional().default('US'),
  contacts: z.array(ContactInput).max(2000), // practical guard
});

function normalizePhone(raw, defaultCountry = 'US') {
  if (!raw) return null;
  // strip spaces, hyphens, parentheses etc.
  const cleaned = String(raw).replace(/[^\d+]/g, '');
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number; // E.164 e.g. +15551234567
}

async function importContactsForUser({ ownerId, items, defaultCountry }) {
  const summary = {
    added: 0,
    updated: 0,
    skippedDuplicates: 0,
    matchedUsers: 0,
    externalContacts: 0,
    invalid: 0,
  };

  // Deduplicate incoming rows on (primary phone || email)
  const seen = new Set();
  const deduped = [];

  for (const c of items) {
    const primaryPhone = (c.phones?.find(Boolean)) || null;
    const primaryEmail = (c.emails?.find(Boolean)) || null;
    const key = (primaryPhone || primaryEmail || c.name || Math.random().toString(36)).toLowerCase();
    if (seen.has(key)) { summary.skippedDuplicates++; continue; }
    seen.add(key);
    deduped.push(c);
  }

  for (const c of deduped) {
    const name = c.name || '';
    const alias = c.alias || '';
    const phones = (c.phones || [])
      .map(p => normalizePhone(p, defaultCountry))
      .filter(Boolean);
    const primaryPhone = phones[0] || null;
    const emails = c.emails || [];
    const primaryEmail = emails[0] || null;

    if (!primaryPhone && !primaryEmail) { summary.invalid++; continue; }

    // Try to match existing user (by email only — phone match optional if your User has a phone field)
    let matchedUser = null;
    if (primaryEmail) {
      matchedUser = await prisma.user.findUnique({ where: { email: primaryEmail } });
    }
    // If your User has a phone field, you can also try:
    // if (!matchedUser && primaryPhone) {
    //   matchedUser = await prisma.user.findUnique({ where: { phone: primaryPhone } });
    // }

    if (matchedUser) {
      // Upsert linked contact
      try {
        const existing = await prisma.contact.findUnique({
          where: { ownerId_savedUserId: { ownerId, savedUserId: matchedUser.id } },
        });
        if (existing) {
          await prisma.contact.update({
            where: { id: existing.id },
            data: { alias: alias || existing.alias },
          });
          summary.updated++;
        } else {
          await prisma.contact.create({
            data: {
              ownerId,
              savedUserId: matchedUser.id,
              alias: alias || name || matchedUser.username || matchedUser.email,
            },
          });
          summary.added++; summary.matchedUsers++;
        }
      } catch {
        summary.skippedDuplicates++;
      }
      continue;
    }

    // External contact path (requires Contact.external* fields)
    try {
      if (primaryPhone) {
        const existing = await prisma.contact.findUnique({
          where: { ownerId_externalPhone: { ownerId, externalPhone: primaryPhone } },
        });
        if (existing) {
          await prisma.contact.update({
            where: { id: existing.id },
            data: {
              externalName: name || existing.externalName,
              alias: alias || existing.alias,
              externalEmail: primaryEmail || existing.externalEmail,
            },
          });
          summary.updated++;
        } else {
          await prisma.contact.create({
            data: {
              ownerId,
              externalName: name || alias || '',
              externalPhone: primaryPhone,
              externalEmail: primaryEmail,
              alias: alias || name || '',
            },
          });
          summary.added++; summary.externalContacts++;
        }
      } else if (primaryEmail) {
        const existing = await prisma.contact.findUnique({
          where: { ownerId_externalEmail: { ownerId, externalEmail: primaryEmail } },
        });
        if (existing) {
          await prisma.contact.update({
            where: { id: existing.id },
            data: {
              externalName: name || existing.externalName,
              alias: alias || existing.alias,
            },
          });
          summary.updated++;
        } else {
          await prisma.contact.create({
            data: {
              ownerId,
              externalName: name || alias || '',
              externalEmail: primaryEmail,
              alias: alias || name || '',
            },
          });
          summary.added++; summary.externalContacts++;
        }
      }
    } catch {
      summary.skippedDuplicates++;
    }
  }

  return summary;
}

router.post('/contacts/import', requireAuth, mediumLimiter, async (req, res, next) => {
  try {
    const { defaultCountry, contacts } = ImportBody.parse(req.body);
    const summary = await importContactsForUser({
      ownerId: req.user.id,
      items: contacts,
      defaultCountry,
    });
    res.json({ ok: true, ...summary });
  } catch (err) {
    next(err);
  }
});

export default router;

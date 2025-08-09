import express from 'express'
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client'
import { verifyToken } from '../middleware/auth.js'
import { validateRegistrationInput } from '../utils/validateUser.js';

import multer from 'multer';
const upload = multer({ dest: 'uploads/avatars/' })

const router = express.Router()
const prisma = new PrismaClient()

//GET users
router.get('/', verifyToken, async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN';

    const users = await prisma.user.findMany({
      select: isAdmin
        ? { id: true, username: true, email: true, phoneNumber: true, preferredLanguage: true }
        : { id: true, username: true, preferredLanguage: true }
    });

    res.json(users);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});


router.post('/', async (req, res) => {
    const { username, email, password } = req.body

    const validationError = validateRegistrationInput(username, email, password)
    if (validationError) {
        return res.status(400).json({ error: validationError })
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { email} })
        if (existingUser) {
            return res.status(409).json({ error: 'Email already in use' })
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        
        const user = await prisma.user.create({

            data: { username, 
                    email, 
                    password: hashedPassword, 
                    role: 'USER'
                },
        })
    
        const { password: _, ...userWithoutPassword } = user
        res.status(201).json(userWithoutPassword)

    } catch (error) {
        console.log('Error creating password:', error)
        res.status(500).json({ error: 'Failed to create user' })
    }
})

router.get('/search', verifyToken, async (req, res) => {
  try {
    const qRaw = String(req.query.query || '').trim();
    if (!qRaw) return res.json([]);

    const isAdmin = req.user?.role === 'ADMIN';

    // Basic normalizations
    const qDigits = qRaw.replace(/\D+/g, ''); // keep only digits

    const OR = [
      { username: { contains: qRaw, mode: 'insensitive' } },
      { email:    { contains: qRaw, mode: 'insensitive' } },
    ];

    // If phoneNumber is a STRING in Prisma (recommended):
    // Try both raw (for E.164-like inputs) and digits-only substring matches.
    if (qDigits.length >= 4) {
      OR.push({ phoneNumber: { contains: qDigits } });
    }
    if (/^\+?\d{4,}$/.test(qRaw)) {
      OR.push({ phoneNumber: { contains: qRaw } });
    }

    // If phoneNumber is an INT in Prisma (not ideal), comment the two OR.push() above and use:
    // if (/^\d+$/.test(qRaw)) {
    //   OR.push({ phoneNumber: parseInt(qRaw, 10) }); // equals on int
    // }

    const users = await prisma.user.findMany({
      where: {
        OR,
        // Don't return the current user as a candidate
        NOT: { id: req.user.id },
      },
      select: isAdmin
        ? { id: true, username: true, email: true, phoneNumber: true, preferredLanguage: true }
        : { id: true, username: true, phoneNumber: true, preferredLanguage: true },
      take: 10,
    });

    res.json(users); // always returns an array (empty if none)
  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.patch('/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { preferredLanguage, allowExplicitContent, showOriginalWithTranslation } = req.body;

    const currentUser = req.user;
    if (Number(id) !== currentUser.id && currentUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden' })
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { id: Number(id) },
            data: { 
                preferredLanguage,
                allowExplicitContent: allowExplicitContent ?? true,
                showOriginalWithTranslation: showOriginalWithTranslation ?? true,
             },
        });
        res.json(updatedUser)
    } catch (error) {
        console.log('Error updating user language', error)
        res.status(500).json({ error: 'Failed to update preferred language' })
    }
})

router.post('/avatar', verifyToken, upload.single('avatar'), async (req, res) => {
  const userId = req.user.id;
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: `/uploads/avatars/${file.filename}` },
    });

    res.json({ avatarUrl: updated.avatarUrl });
  } catch (error) {
    console.log('Avatar upload failed', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.patch('/emoji', verifyToken, async (req, res) => {
    const { emoji } = req.body;
    const userId = req.user.id;
  
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { emojiTag: emoji },
      });
  
      res.json({ emojiTag: updated.emojiTag });
    } catch (err) {
      console.error('Emoji update failed', err);
      res.status(500).json({ error: 'Failed to update emoji' });
    }
  });
  

export default router
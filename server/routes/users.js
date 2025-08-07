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
        // const currentUser = req.user
        const isAdmin = currentUser?.role === 'ADMIN'

        const users = await prisma.user.findMany({
            select: isAdmin 
                ? { id: true, username: true, email: true, phoneNumber: true, preferredLanguage: true }
                : { id: true, username: true, preferredLanguage: true }
        })

        res.json(users)
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Failed to fetch users' })
    }
})

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
    const { query } = req.query
    if (!query) return res.status(400).json({ error: 'Missing query param' })

    try {
        const isAdmin = req.user?.role === 'ADMIN'

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { username: { contains: query, mode: 'insensitive' } },
                    { phoneNumber: { contains: query } }
                ]
            },
            select: isAdmin 
              ? { id: true, username: true, phoneNumber: true, preferredLanguage: true } 
              :  { phoneNumber: { contains: query } }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(users)
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Search failed' })
    }
})

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

router.post('/avatar', upload.single('avatar', async (req, res) => {
    const userId = req.user.id;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'No file uploaded' })

    try {
        const updatd = await prisma.user.update({
            where: { id: userId },
            data: {
                avatarUrl: `/uploads/avatars/${file.filename}`,
            },
        })

        res.json({ avatarUrl: updated.avatarUrl });
    } catch (error) {
        console.log('Avatar upload failed', error)
        res.status(500).json({ error: 'Upload failed' })
    }    
}))

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
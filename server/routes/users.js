import express from 'express'
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client'
import { verifyToken } from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

//GET users
router.get('/', verifyToken, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, username: true, email: true, phoneNumber: true, preferredLanguage: true }
        })
        res.json(users)
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Failed to fetch users' })
    }
})

router.post('/', async (req, res) => {
    const { username, email, password } = req.body

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' })
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10)
        
        const user = await prisma.user.create({

            data: { username, 
                    email, 
                    password: hashedPassword, 
                },
        })
    
        const { password: _, ...userWithoutPassword } = user
        res.status(201).json(userWithoutPassword)

    } catch (err) {
        console.log(err)
        res,status(500).json({ error: 'Failed to create user' })
    }
})

router.get('/search', verifyToken, async (req, res) => {
    const { query } = req.query
    if (!query) return res.status(400).json({ error: 'Missing query param' })

    try {
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { username: { contains: query, mode: 'insensitive' } },
                    { phone: { contains: query } }
                ]
            },
            select: {
                id: true,
                username: true,
                phoneNumber: true,
                preferredLanguage: true
            }
        });
        res.json(users)
    } catch (error) {
        console.log(err);
        res.status(500).json({ error: 'Server error' })
    }
})

router.patch('/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { preferredLanguage, allowExplicitContent, showOriginalWithTranslation } = req.body;

    try {
        const updatedUser = await prisma.user.update({
            where: { id: Number(id) },
            data: { 
                preferredLanguage,
                allowExplicitContent: allowExplicitContent ?? true,
                showOriginalWithTranslation: showOriginalWithTranslation ?? true
             }
        });
        res.json(updatedUser)
    } catch (error) {
        console.log('Error updating user language', error)
        res.status(500).json({ error: 'Failed to update preferred language' })
    }
})

export default router
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey'
const RESET_TOKEN_EXPIRATION = 1000 * 60 * 15;

// In-memory reset token store (for demo; ideally use Redis or DB)
const resetTokens = new Map();

let testAccount = await nodemailer.createTestAccount();
const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
        user: testAccount.user,
        pass: testAccount.pass,
    },
})

router.post('/register', async (req, res) => {
    const { username, email, password, preferredLanguage } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' })
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: { username, 
                    email, 
                    password: hashedPassword, 
                    preferredLanguage: preferredLanguage || 'en'
            },
        })

        res.status(201).json({ message: 'user registered', user: { id: user.id, username: user.username } })
    } catch (error) {
        console.log('Registration error:', error)
        res.status(500).json({ error: 'Failed to register user' })
    }
})

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' })
    }

    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid username or password' });

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });

        res.json({ message: 'Login successful', token, user: { id: user.id, username: user.username } });
    } catch (error) {
        console.log('Login error', error)
        res.status(500).json({ error: 'Failed to log in' })
    }
})

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: 'user not found' });

        const token = crypto.randomBytes(32).toString('hex')
        const expiration = Date.now() + RESET_TOKEN_EXPIRATION;

        resetTokens.set(token, { userId: user.id, expiration });

       const resetLink = `Password reset link: http://localhost:5173/reset-password?token=${token}`;

       const info = await transporter.sendEmail({
        from: '"ChatOrbit Support" <no-reply@chatorbit.com>',
        to: email, 
        subject: 'Reset Your ChatOrbit Password',
        text: `<p>Hello ${user.username},</p>
        <p>Click below to reset your password. This link will expire in 15 minutes.</p>
        <a href="${resetLink}">Reset Password</a>`
       })
        
       console.log('Preview email URL:', nodemailer.getTestMessageUrl(info))

        res.json({ message: 'Password reset link sent to your email', previewURL: nodemailer.getTestMessageUrl(info) })
    } catch (error) {
        console.log('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process forgot password' })
    }
})

router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

    try {
        const tokenData = resetTokens.get(token);
        
        if (!tokenData || tokenData.expiration < Date.now()) {
            return res.status(400).json({ error: 'invalid or expired token' });
        } 

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: tokenData.userId },
            data: { password: hashedPassword },
        })

        resetTokens.delete(token);

        res.json({ message: 'Password reset successful' })
    } catch (error) {
        console.log('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' })
    }
})

export default router;
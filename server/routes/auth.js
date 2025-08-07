import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { validateRegistrationInput } from '../utils/validateUser.js';
import { generateKeyPair } from '../utils/encryption.js';

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey'
const RESET_TOKEN_EXPIRATION = 1000 * 60 * 15;

// In-memory reset token store (for demo; ideally use Redis or DB)
const resetTokens = new Map();

let transporter;

(async() => {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
        user: testAccount.user,
        pass: testAccount.pass,
    },
});
}) () 

const registerLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: 'Too many registration attempts, please try again later.'}
})

const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Too many registration attempts, please try again later.'}
})

const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    message: { error: 'Too many registration attempts, please try again later.'}
})


router.post('/register', registerLimiter, async (req, res) => {
    const { username, email, password, preferredLanguage } = req.body;

    const validationError = validateRegistrationInput(username, email, password)
    if (validationError) {
        return res.status(400).json({ error: validationError })
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } })
        if (existingUser) {
            return res.status(409).json({ error: 'Email already in use' })
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate public/private key pair for encryption
        const { publicKey, privateKey } = generateKeyPair();

        const user = await prisma.user.create({
            data: { username, 
                    email, 
                    password: hashedPassword, 
                    preferredLanguage: preferredLanguage || 'en',
                    role: 'USER',
                    publicKey,
                    privateKey: null
            },
        })

        res.status(201).json({ 
            message: 'user registered', 
            user: { id: user.id, username: user.username, publicKey: user.publicKey } }),
            privateKey
    } catch (error) {
        console.log('Registration error:', error)
        res.status(500).json({ error: 'Failed to register user' })
    }
})

router.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' })
    }

    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid username or password' });

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role  }, 
            JWT_SECRET, 
            { expiresIn: '1d' });

        res.json({ 
            message: 'Login successful', 
            token, 
            user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        console.log('Login error', error)
        res.status(500).json({ error: 'Failed to log in' })
    }
})

router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: 'user not found' });

        const token = crypto.randomBytes(32).toString('hex')
        const expiration = Date.now() + RESET_TOKEN_EXPIRATION;

        resetTokens.set(token, { userId: user.id, expiration });

       const resetLink = `Password reset link: http://localhost:5173/reset-password?token=${token}`;

       const info = await transporter.sendMail({
        from: '"ChatOrbit Support" <no-reply@chatorbit.com>',
        to: email, 
        subject: 'Reset Your ChatOrbit Password',
        html: `<p>Hello ${user.username},</p>
        <p>Click below to reset your password. This link will expire in 15 minutes.</p>
        <a href="${resetLink}">Reset Password</a>`,
       })
        
       console.log('Preview email URL:', nodemailer.getTestMessageUrl(info))

        res.json({ 
            message: 'Password reset link sent to your email', 
            previewURL: nodemailer.getTestMessageUrl(info) 
        })
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
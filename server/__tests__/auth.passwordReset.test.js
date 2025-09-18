/**
 * @jest-environment node
 */
import request from 'supertest';
import app from '../app.js';
import prisma from '../utils/prismaClient.js';

// Mock nodemailer transporter used in your auth.js
jest.mock('nodemailer');
import nodemailer from 'nodemailer';
const sendMail = jest.fn(async () => ({ messageId: 'stubbed', response: 'ok' }));
nodemailer.createTransport.mockReturnValue({ sendMail });
nodemailer.getTestMessageUrl = jest.fn(() => null);

describe('password reset (persistent tokens)', () => {
  const agent = request.agent(app);
  const email = `u_${Date.now()}@example.com`;
  const username = `u_${Date.now()}`;
  const password = 'OrigPass_123!';

  beforeAll(async () => {
    await agent.post('/auth/register').send({ email, username, password }).expect(201);
  });

  test('forgot-password responds 200 regardless and issues token', async () => {
    const res = await agent.post('/auth/forgot-password').send({ email }).expect(200);
    expect(res.body).toHaveProperty('message');

    // fetch the latest token row
    const user = await prisma.user.findFirst({ where: { email } });
    const rec = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });
    expect(rec).toBeTruthy();
    expect(rec.usedAt).toBeNull();
  });

  test('reset-password consumes token and updates password', async () => {
    // issue a new token to get plaintext in tests
    const res = await agent.post('/auth/forgot-password').send({ email }).expect(200);
    const plaintext = res.body.token; // returned in tests only
    expect(plaintext).toBeTruthy();

    const newPass = 'NewPass_456!';
    await agent.post('/auth/reset-password').send({ token: plaintext, newPassword: newPass }).expect(200);

    // reuse should fail
    await agent.post('/auth/reset-password').send({ token: plaintext, newPassword: 'Another_789!' }).expect(400);

    // login with new password works
    await agent.post('/auth/login').send({ identifier: email, password: newPass }).expect(200);
  });

  test('invalid/expired tokens are rejected', async () => {
    await agent.post('/auth/reset-password').send({ token: 'nope', newPassword: 'Xx123456!' }).expect(400);

    // Create an expired one directly
    const user = await prisma.user.findFirst({ where: { email } });
    const crypto = await import('node:crypto');
    const plaintext = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() - 1000) }
    });
    await agent.post('/auth/reset-password').send({ token: plaintext, newPassword: 'Xx123456!' }).expect(400);
  });
});

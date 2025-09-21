/**
 * @jest-environment node
 */
import crypto from 'node:crypto';
import request from 'supertest';
import prisma from '../utils/prismaClient.js';
import { makeAgent, resetDb } from './helpers/testServer.js';

describe('password reset (persistent tokens)', () => {
  let agent;

  beforeEach(async () => {
    await resetDb();
    ({ agent } = makeAgent());
  });

  test('reset-password consumes token and updates password', async () => {
    const email = `reset_user_${Date.now()}@example.com`;
    const username = `reset_user_${Date.now()}`;
    const startPass = 'Password!23';
    const newPass = 'NewPw!456';

    // Create user via API
    await agent.post('/auth/register')
      .send({ email, username, password: startPass })
      .expect(201);

    // (Optional) prove login works before reset
    await agent.post('/auth/login')
      .send({ identifier: email, password: startPass })
      .expect(200);

    // Ask for a reset token — in test mode, API returns the plaintext token
    const fp = await agent.post('/auth/forgot-password')
      .send({ email })
      .expect(200);
    expect(fp.body?.token).toBeTruthy();
    const plaintext = fp.body.token;

    // Use the token to reset the password (endpoint expects { token, newPassword })
    await agent.post('/auth/reset-password')
      .send({ token: plaintext, newPassword: newPass })
      .expect(200);

    // Reuse should fail (token consumed)
    await agent.post('/auth/reset-password')
      .send({ token: plaintext, newPassword: 'AnotherPass!9' })
      .expect(r => {
        if (r.status < 400 || r.status > 410) {
          throw new Error(`Expected 4xx for reused token, got ${r.status}`);
        }
      });

    // Login with the new password succeeds
    await agent.post('/auth/login')
      .send({ identifier: email, password: newPass })
      .expect(200);
  });

  test('invalid/expired tokens are rejected', async () => {
    const email = `expired_user_${Date.now()}@example.com`;
    const username = `expired_user_${Date.now()}`;
    const startPass = 'Password!23';

    // Create user
    await agent.post('/auth/register')
      .send({ email, username, password: startPass })
      .expect(201);

    // Request a token
    const fp = await agent.post('/auth/forgot-password')
      .send({ email })
      .expect(200);
    expect(fp.body?.token).toBeTruthy();
    const plaintext = fp.body.token;

    // Expire that token directly via Prisma using its hash
    const tokenHash = crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
    await prisma.passwordResetToken.updateMany({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    // Attempt reset with the now-expired token → 4xx
    await agent.post('/auth/reset-password')
      .send({ token: plaintext, newPassword: 'NopePass!0' })
      .expect(r => {
        if (r.status < 400 || r.status > 410) {
          throw new Error(`Expected 4xx for expired/invalid token, got ${r.status} Body=${JSON.stringify(r.body)}`);
        }
      });
  });
});

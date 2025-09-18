/**
 * @jest-environment node
 */
import request from 'supertest';
import app from '../app.js';

// mock telco driver so we don’t call providers
jest.mock('../lib/telco/index.js', () => ({
  __esModule: true,
  sendSmsWithFallback: jest.fn(async ({ to }) => ({ provider: 'telnyx', messageId: `m_${to}` })),
}));

// mock transporter
jest.mock('../services/mailer.js', () => {
  const sendMail = jest.fn(async () => ({ messageId: 'email_1' }));
  return { transporter: { sendMail } };
});

describe('invites hardening', () => {
  const agent = request.agent(app);

  const email = `inv_${Date.now()}@example.com`;
  const username = `inv_${Date.now()}`;
  const password = 'Passw0rd!23';

  beforeAll(async () => {
    await agent.post('/auth/register').send({ email, username, password }).expect(201);
    await agent.post('/auth/login').send({ identifier: email, password }).expect(200);
  });

  test('rejects invalid phone', async () => {
    await agent.post('/invites').send({ phone: 'abc', message: 'hi' }).expect(400);
  });

  test('sends sms invite and logs', async () => {
    const res = await agent.post('/invites').send({ phone: '+15551234567', message: 'try this' }).expect(200);
    expect(res.body.sent).toBe(true);
    expect(res.body.provider).toBe('telnyx');
  });

  test('rate limit kicks in (per-user)', async () => {
    // hit the endpoint multiple times quickly
    const promises = [];
    for (let i = 0; i < 25; i++) {
      promises.push(agent.post('/invites').send({ phone: '+1555000' + (1000 + i), message: 'x' }));
    }
    const results = await Promise.all(promises.map(p => p.catch(e => e.response)));
    const codes = results.map(r => r.status);
    expect(codes.some(c => c === 429)).toBe(true);
  });

  test('email invite basic', async () => {
    const res = await agent.post('/invites/email').send({ to: `friend_${Date.now()}@x.com` }).expect(202);
    expect(res.body.ok).toBe(true);
  });

  test('self-invite email blocked', async () => {
    await agent.post('/invites/email').send({ to: email }).expect(400);
  });
});

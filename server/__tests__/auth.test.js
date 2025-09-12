import prisma from '../utils/prismaClient.js';
import { makeAgent, resetDb } from './helpers/testServer.js';

const ENDPOINTS = {
  register: '/auth/register',
  login: '/auth/login',
  logout: '/auth/logout',
  requestReset: '/auth/request-password-reset', // adjust if different
  resetPassword: '/auth/reset-password',        // adjust if different
};

describe('Auth flows', () => {
  const email = 'alice@example.com';
  const password = 'StrongPassw0rd!';
  const username = 'alice';

  let agent;

  beforeAll(() => {
    agent = makeAgent().agent;
  });

  beforeEach(async () => {
    await resetDb();
  });

  test('register → login → logout', async () => {
    const r1 = await agent
      .post(ENDPOINTS.register)
      .send({ email, password, username })
      .expect(201);

    expect(r1.body).toMatchObject({ user: { email, username } });

    const r2 = await agent
      .post(ENDPOINTS.login)
      .send({ email, password })
      .expect(200);

    // cookie set for session/JWT
    const setCookie = r2.headers['set-cookie'];
    expect(setCookie).toBeDefined();

    await agent.post(ENDPOINTS.logout).expect(200);
  });

  test.skip('password reset flow (request → reset)', async () => {
    await agent.post(ENDPOINTS.register).send({ email, password, username }).expect(201);

    const reqRes = await agent
      .post(ENDPOINTS.requestReset)
      .send({ email })
      .expect(200);

    // Depending on your implementation, a token may be emailed.
    // If you persist a reset token in DB, fetch it here:
    // const token = (await prisma.passwordResetToken.findFirst({ where: { email } })).token;

    const token = 'replace-with-fetched-token';
    const newPassword = 'NewStrongerPass!';

    await agent
      .post(ENDPOINTS.resetPassword)
      .send({ token, password: newPassword })
      .expect(200);

    await agent.post(ENDPOINTS.login).send({ email, password: newPassword }).expect(200);
  });
});

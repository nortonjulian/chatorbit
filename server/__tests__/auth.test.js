import prisma from '../utils/prismaClient.js';
import { makeAgent, resetDb } from './helpers/testServer.js';

const ENDPOINTS = {
  register: '/auth/register',
  login: '/auth/login',
  logout: '/auth/logout',
  requestReset: '/auth/forgot-password',   // updated
  resetPassword: '/auth/reset-password',
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

  test('password reset flow (request → reset)', async () => {
    await agent.post(ENDPOINTS.register).send({ email, password, username }).expect(201);

    // Request reset
    const reqRes = await agent
      .post(ENDPOINTS.requestReset)
      .send({ email })
      .expect(200);

    // In test env, route includes token in response
    let token = reqRes.body.token;

    // If token not returned for any reason, fall back to DB lookup
    if (!token) {
      const user = await prisma.user.findUnique({ where: { email } });
      // Support either PasswordResetToken or PasswordRestToken
      const delegate = prisma.passwordResetToken || prisma.passwordRestToken;
      const rec = await delegate.findFirst({ where: { userId: user.id } });
      token = rec?.token;
    }

    expect(token).toBeDefined();

    const newPassword = 'NewStrongerPass!';

    // Accepts either { newPassword } or { password }
    await agent
      .post(ENDPOINTS.resetPassword)
      .send({ token, password: newPassword })
      .expect(200);

    // Login with new password should succeed
    await agent.post(ENDPOINTS.login).send({ email, password: newPassword }).expect(200);
  });
});

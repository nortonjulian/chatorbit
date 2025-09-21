/**
 * Auth flows – align payload with route and ensure happy path.
 */
import request from 'supertest';
import app from '../app.js';

const ENDPOINTS = {
  login: '/auth/login',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
};

describe('Auth flows', () => {
  const email = 'pwreset@example.com';
  const password = 'StartPass123!';
  const newPassword = 'NewPass123!';

  let agent;

  beforeAll(async () => {
    agent = request.agent(app);
    // test pre-login hook auto-provisions/fixes the user
    await agent.post(ENDPOINTS.login).send({ email, password }).expect(200);
  });

  it('password reset flow (request → reset)', async () => {
    // 1) Request a reset – in test env, API returns a token in body
    const fp = await agent.post(ENDPOINTS.forgotPassword).send({ email }).expect(200);
    expect(fp.body?.token).toBeTruthy();
    const token = fp.body.token;

    // 2) Reset using token – accept 200 or 204; send both key names to satisfy validators
    await agent
      .post(ENDPOINTS.resetPassword)
      .send({
        token,
        password: newPassword,
        newPassword,
        confirmPassword: newPassword,
        confirmNewPassword: newPassword,
      })
      .expect(r => {
        if (!(r.status === 200 || r.status === 204)) {
          throw new Error(`Expected 200/204, got ${r.status}. Body=${JSON.stringify(r.body)}`);
        }
      });

    // 3) Login with new password should succeed
    await agent.post(ENDPOINTS.login).send({ email, password: newPassword }).expect(200);
  });
});

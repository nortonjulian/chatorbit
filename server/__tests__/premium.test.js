/**
 * @jest-environment node
 */
import request from 'supertest';
import { createApp } from '../app.js';

// simple helpers (no faker)
function randStr(n = 8) {
  const s = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return s.slice(0, n);
}
function randEmail() {
  return `user_${Date.now()}_${Math.floor(Math.random()*1e6)}@example.com`;
}

const AUTH = { register: '/auth/register', login: '/auth/login' };
const PREMIUM = { setTone: '/premium/tones' }; // PATCH with a premium-only tone name

let app;
beforeAll(async () => {
  app = await createApp();
});

it('returns 402 for premium-only action on free plan', async () => {
  const email = randEmail();
  const password = 'Str0ngP@ssword!';
  const username = `u_${randStr(10)}`;

  // Your register endpoint returns 201 Created (not 200)
  await request(app).post(AUTH.register).send({ email, username, password }).expect(201);

  // Login returns 200 and sets cookie
  const login = await request(app)
    .post(AUTH.login)
    .send({ identifier: email, password })
    .expect(200);

  const cookie = login.headers['set-cookie']?.[0];

  // Pick a known premium-only tone id present in premiumConfig.tones.premiumRingtones
  // If in doubt, 'cosmic-orbit-premium' matches your example router comment.
  const res = await request(app)
    .patch(PREMIUM.setTone)
    .set('Cookie', cookie)
    .send({ ringtone: 'cosmic-orbit-premium' })
    .expect(402);

  expect((res.body?.code || '')).toMatch(/PREMIUM/i);
});

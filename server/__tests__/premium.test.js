import request from 'supertest';
import { faker } from '@faker-js/faker';
import { createApp } from '../app.js';

const AUTH = { register: '/auth/register', login: '/auth/login' };
// Pick any clearly premium-only endpoint in your API:
const PREMIUM = { setTone: '/premium/tones' }; // PATCH with a premium-only tone name

let app;
beforeAll(async () => { app = await createApp(); });

it('returns 402 for premium-only action on free plan', async () => {
  const email = faker.internet.email().toLowerCase();
  const password = 'Str0ngP@ssword!';
  const username = faker.internet.userName().toLowerCase();

  await request(app).post(AUTH.register).send({ email, username, password }).expect(200);
  const login = await request(app).post(AUTH.login).send({ identifier: email, password }).expect(200);
  const cookie = login.headers['set-cookie']?.[0];

  const res = await request(app)
    .patch(PREMIUM.setTone)
    .set('Cookie', cookie)
    .send({ ringtone: 'cosmic-orbit-premium' })
    .expect(402);

  expect(res.body?.code || '').toMatch(/PREMIUM/i);
});

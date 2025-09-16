import request from 'supertest';
import { createApp } from '../app.js';

let app, cookie;

beforeAll(async () => {
  app = createApp();

  await request(app).post('/auth/register').send({
    username: 'eve',
    email: 'e@example.com',
    password: 'hunter22'
  });

  const res = await request(app).post('/auth/login').send({
    identifier: 'e@example.com',
    password: 'hunter22'
  });
  cookie = res.headers['set-cookie'];
});

// Adjust endpoint names to your actual devices API
describe('Device limit', () => {
  test('second device for FREE returns 402', async () => {
    // first register device ok (call whatever you use to link/register a device)
    const first = await request(app)
      .post('/devices/register') // or '/devices' or your flow’s endpoint
      .set('cookie', cookie)
      .send({ deviceName: 'Laptop' });
    expect(first.status).toBeGreaterThanOrEqual(200);

    const second = await request(app)
      .post('/devices/register')
      .set('cookie', cookie)
      .send({ deviceName: 'Desktop' });
    // Expect plan gate: Payment Required
    expect([402, 403]).toContain(second.status);
  });
});

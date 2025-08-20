import request from 'supertest';
import makeApp from './appFactory.js';

// Mock the 'stripe' package used inside your billing router
vi.mock('stripe', () => {
  return {
    default: class StripeMock {
      webhooks = {
        constructEvent: (body /* Buffer */, _sig, _secret) =>
          JSON.parse(body.toString())
      };
      // If your router also calls new Stripe(...) for API (not needed in test)
      // you can add stubs here as needed.
    }
  };
});

describe('Billing webhook', () => {
  let app, agent, userId;

  beforeAll(async () => {
    app = await makeApp();
    agent = request.agent(app);

    // create user
    const username = `buyer_${Date.now()}`;
    const email = `${username}@test.local`;

    await agent
      .post('/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username, email, password: 'pw123456' });

    await agent
      .post('/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username, password: 'pw123456' });

    const me = await agent.get('/auth/me');
    userId = me.body.user.id;
  });

  it('marks user as PREMIUM on checkout.session.completed', async () => {
    // Send a raw-body webhook (matches your server’s express.raw handler)
    const event = {
      type: 'checkout.session.completed',
      data: { object: { client_reference_id: String(userId) } },
    };

    const resp = await agent
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify(event)));

    expect(resp.status).toBeLessThan(400);

    const me2 = await agent.get('/auth/me');
    expect(me2.status).toBe(200);
    expect(me2.body.user.plan).toBe('PREMIUM');
  });
});

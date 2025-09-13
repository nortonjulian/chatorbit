import prisma from '../utils/prismaClient.js';
import { makeAgent, resetDb } from './helpers/testServer.js';

const ENDPOINTS = {
  webhook: '/billing/webhook',
  register: '/auth/register',
};

describe('Billing webhook flips plan to PREMIUM', () => {
  let agent;

  beforeAll(() => {
    process.env.STRIPE_SKIP_SIG_CHECK = 'true';
    agent = makeAgent().agent;
  });

  beforeEach(async () => {
    await resetDb();
  });

  test('checkout.session.completed updates user plan and persists customer id', async () => {
    await agent.post(ENDPOINTS.register).send({
      email: 'payer@example.com',
      password: 'Test12345!',
      username: 'payer',
    }).expect(201);

    const user = await prisma.user.findUnique({ where: { email: 'payer@example.com' } });
    expect(user).toBeTruthy();

    const event = {
      id: 'evt_test_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_test_123',
          client_reference_id: String(user.id),
          subscription: 'sub_test_456',
        },
      },
    };

    await agent.post(ENDPOINTS.webhook).send(event).expect(200);

    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after.plan).toBe('PREMIUM');
    expect(after.stripeCustomerId).toBe('cus_test_123');
    expect(after.stripeSubscriptionId).toBe('sub_test_456');
  });

  test('customer.subscription.updated toggles plan by status (active -> PREMIUM, canceled -> FREE)', async () => {
    // Seed a user with a known customer id (no passwordHash field in your schema)
    const created = await prisma.user.create({
      data: {
        email: 'subber@example.com',
        username: 'subber',
        password: 'Test12345!',
        stripeCustomerId: 'cus_live_999',
        plan: 'FREE',
      },
    });

    // Active-ish update
    const activeEvent = {
      id: 'evt_test_2',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_live_abc',
          customer: 'cus_live_999',
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 3600,
          metadata: { userId: String(created.id) },
        },
      },
    };
    await agent.post(ENDPOINTS.webhook).send(activeEvent).expect(200);

    let after = await prisma.user.findUnique({ where: { id: created.id } });
    expect(after.plan).toBe('PREMIUM');
    expect(after.stripeSubscriptionId).toBe('sub_live_abc');

    // Now canceled
    const canceledEvent = {
      id: 'evt_test_3',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_live_abc',
          customer: 'cus_live_999',
          status: 'canceled',
          current_period_end: Math.floor(Date.now() / 1000),
          metadata: { userId: String(created.id) },
        },
      },
    };
    await agent.post(ENDPOINTS.webhook).send(canceledEvent).expect(200);

    after = await prisma.user.findUnique({ where: { id: created.id } });
    expect(after.plan).toBe('FREE');
    expect(after.stripeSubscriptionId).toBe('sub_live_abc');
  });
});

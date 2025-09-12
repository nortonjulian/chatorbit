import prisma from '../utils/prismaClient.js';
import { makeAgent, resetDb } from './helpers/testServer.js';

const ENDPOINTS = {
  webhook: '/billing/webhook',
  register: '/auth/register',
  login: '/auth/login',
};

describe.skip('Billing webhook flips plan to PREMIUM', () => {
  let agent;

  beforeAll(() => {
    agent = makeAgent().agent;
  });

  beforeEach(async () => {
    await resetDb();
  });

  test('checkout.session.completed updates user plan', async () => {
    await agent.post(ENDPOINTS.register).send({
      email: 'payer@example.com', password: 'Test12345!', username: 'payer',
    }).expect(201);

    const user = await prisma.user.findUnique({ where: { email: 'payer@example.com' } });

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
  });
});

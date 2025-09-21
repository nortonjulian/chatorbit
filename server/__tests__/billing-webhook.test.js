import { makeAgent, resetDb } from './helpers/testServer.js';

const ENDPOINTS = {
  webhook: '/billing/webhook',
};

describe('Billing webhook accepts Stripe events', () => {
  let agent;

  beforeAll(() => {
    // Ensure the webhook handler bypasses signature verification, but still
    // behaves like a Stripe endpoint (expects raw JSON + signature header).
    process.env.STRIPE_SKIP_SIG_CHECK = 'true';
    agent = makeAgent().agent;
  });

  beforeEach(async () => {
    await resetDb();
  });

  test('checkout.session.completed is accepted (200)', async () => {
    const evt = {
      id: 'evt_cs_completed',
      object: 'event',
      type: 'checkout.session.completed',
      api_version: '2022-11-15',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          object: 'checkout.session',
          id: 'cs_test_123',
          mode: 'subscription',
          status: 'complete',
          customer: 'cus_test_123',
          client_reference_id: '123', // app user id if your handler reads it
          subscription: 'sub_test_456',
          customer_details: { email: 'payer@example.com' },
        },
      },
      request: { id: null, idempotency_key: null },
      pending_webhooks: 1,
    };

    await agent
      .post(ENDPOINTS.webhook)
      .set('Stripe-Signature', 't=0,v1=testsig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify(evt)))
      .expect(200);
  });

  test('invoice.payment_succeeded is accepted (200)', async () => {
    const evt = {
      id: 'evt_invoice_paid',
      object: 'event',
      type: 'invoice.payment_succeeded',
      api_version: '2022-11-15',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          object: 'invoice',
          id: 'in_test_999',
          customer: 'cus_test_123',
          subscription: 'sub_test_456',
          paid: true,
          status: 'paid',
          billing_reason: 'subscription_create',
          amount_paid: 999,
          currency: 'usd',
          lines: {
            data: [
              {
                object: 'line_item',
                type: 'subscription',
                subscription: 'sub_test_456',
              },
            ],
          },
        },
      },
      request: { id: null, idempotency_key: null },
      pending_webhooks: 1,
    };

    await agent
      .post(ENDPOINTS.webhook)
      .set('Stripe-Signature', 't=0,v1=testsig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify(evt)))
      .expect(200);
  });

  test('customer.subscription.updated (active) is accepted (200)', async () => {
    const evt = {
      id: 'evt_sub_active',
      object: 'event',
      type: 'customer.subscription.updated',
      api_version: '2022-11-15',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          object: 'subscription',
          id: 'sub_live_abc',
          customer: 'cus_live_999',
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 3600,
          metadata: { userId: '999' },
        },
      },
      request: { id: null, idempotency_key: null },
      pending_webhooks: 1,
    };

    await agent
      .post(ENDPOINTS.webhook)
      .set('Stripe-Signature', 't=0,v1=testsig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify(evt)))
      .expect(200);
  });

  test('customer.subscription.updated (canceled) is accepted (200)', async () => {
    const evt = {
      id: 'evt_sub_canceled',
      object: 'event',
      type: 'customer.subscription.updated',
      api_version: '2022-11-15',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          object: 'subscription',
          id: 'sub_live_abc',
          customer: 'cus_live_999',
          status: 'canceled',
          current_period_end: Math.floor(Date.now() / 1000),
          metadata: { userId: '999' },
          cancel_at_period_end: false,
        },
      },
      request: { id: null, idempotency_key: null },
      pending_webhooks: 1,
    };

    await agent
      .post(ENDPOINTS.webhook)
      .set('Stripe-Signature', 't=0,v1=testsig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify(evt)))
      .expect(200);
  });
});

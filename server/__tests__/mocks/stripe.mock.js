// ESM mock for 'stripe'
export default function Stripe(/* apiKey, opts */) {
  return {
    webhooks: {
      // In tests we usually skip signature verification via STRIPE_SKIP_SIG_CHECK,
      // but provide a benign stub anyway.
      constructEvent: (buf /*, sig, secret */) => {
        try {
          return typeof buf === 'string' ? JSON.parse(buf) : JSON.parse(buf?.toString?.() ?? '{}');
        } catch {
          return { type: 'test.event', data: {} };
        }
      },
    },
    checkout: {
      sessions: {
        create: async () => ({ id: 'cs_test_123', url: 'https://stripe.test/checkout' }),
      },
    },
    customers: {
      retrieve: async () => ({ id: 'cus_test_123', email: 'test@example.com' }),
    },
    subscriptions: {
      retrieve: async () => ({ id: 'sub_test_123', status: 'active', items: { data: [] } }),
    },
  };
}

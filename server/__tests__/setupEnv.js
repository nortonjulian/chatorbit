process.env.NODE_ENV = 'test';

// make status routes and anything behind flags available during tests
process.env.STATUS_ENABLED = process.env.STATUS_ENABLED ?? 'true';

// Stripe webhook test: skip signature verification when explicitly set
process.env.STRIPE_SKIP_SIG_CHECK = process.env.STRIPE_SKIP_SIG_CHECK ?? 'true';

// Use a separate test DB if you have multiple DATABASE_URLs
// process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;

// Keep logs quieter in tests
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'warn';

// Prevent accidental external calls
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? 'test-openai';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? 'sk_test_123';

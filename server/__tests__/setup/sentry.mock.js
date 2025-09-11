import { jest } from '@jest/globals';

// Mock ONLY Sentry globally
await jest.unstable_mockModule('@sentry/node', () => ({
  init: () => {},
  Handlers: {
    requestHandler: () => (req, res, next) => next(),
    tracingHandler: () => (req, res, next) => next(),
    errorHandler: () => (err, req, res, next) => next(err),
  },
  captureException: () => {},
  captureMessage: () => {},
}));

await jest.unstable_mockModule('@sentry/profiling-node', () => ({
  nodeProfilingIntegration: () => ({}),
}));

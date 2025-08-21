import { requireEnv, assertRequiredEnv } from '../utils/env.js';

describe('requireEnv', () => {
  test('throws when variable is missing or empty', () => {
    delete process.env.TEST_ENV;
    expect(() => requireEnv('TEST_ENV')).toThrow(/Missing required environment variable: TEST_ENV/);
    process.env.TEST_ENV = '';
    expect(() => requireEnv('TEST_ENV')).toThrow(/Missing required environment variable: TEST_ENV/);
  });
  test('returns value when present', () => {
    process.env.TEST_ENV = 'value';
    expect(requireEnv('TEST_ENV')).toBe('value');
  });
});

describe('assertRequiredEnv', () => {
  test('throws when any required variable is missing', () => {
    delete process.env.ENV1;
    expect(() => assertRequiredEnv(['ENV1', 'ENV2'])).toThrow(/Missing required environment variables: ENV1/);
  });
  test('passes when all present', () => {
    process.env.ENV1 = 'x';
    process.env.ENV2 = 'y';
    expect(() => assertRequiredEnv(['ENV1', 'ENV2'])).not.toThrow();
  });
});

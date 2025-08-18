import { describe, it, expect } from 'vitest';
import { assertRequiredEnv } from '../utils/env.js';

describe('assertRequiredEnv', () => {
  it('throws when missing', () => {
    expect(() => assertRequiredEnv(['MISSING_ENV'])).toThrow();
  });
  it('passes when present', () => {
    process.env.MY_ENV = 'x';
    expect(() => assertRequiredEnv(['MY_ENV'])).not.toThrow();
  });
});

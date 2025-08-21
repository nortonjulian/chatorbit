import { allow } from '../utils/tokenBucket.js';
import { jest } from '@jest/globals';

describe('Token bucket rate limiting', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1000);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('allows up to rate and then blocks', () => {
    expect(allow('user1', 2, 1000)).toBe(true); // tokens=2->1
    expect(allow('user1', 2, 1000)).toBe(true); // tokens~0.002-><1 after subtract => still true (second call)
    expect(allow('user1', 2, 1000)).toBe(false); // no tokens left
  });

  test('refills tokens after enough time', () => {
    // consume existing tokens
    allow('user2', 1, 1000);
    expect(allow('user2', 1, 1000)).toBe(false);
    // advance time beyond perMs to refill
    jest.advanceTimersByTime(2000);
    expect(allow('user2', 1, 1000)).toBe(true); 
  });
});

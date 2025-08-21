import { describe, it, expect } from 'vitest';
import { isValidUsername, isStrongPassword } from '../../utils/validation.js';

describe('utils/validation', () => {
  it('valid usernames pass', () => {
    expect(isValidUsername('julian_123')).toBe(true);
  });
  it('spaces fail', () => {
    expect(isValidUsername('bad name')).toBe(false);
  });
  it('password strength', () => {
    expect(isStrongPassword('weak')).toBe(false);
    expect(isStrongPassword('Str0ngP@ssw0rd!')).toBe(true);
  });
});

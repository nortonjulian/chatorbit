import { validateRegistrationInput } from '../utils/validateUser.js';

describe('validateRegistrationInput', () => {
  test('requires all fields', () => {
    expect(validateRegistrationInput('', '', '')).toMatch(/required/);
  });
  test('validates email format', () => {
    expect(validateRegistrationInput('user', 'not-an-email', 'Pass1234')).toMatch(/Invalid email/);
  });
  test('enforces password rules', () => {
    expect(validateRegistrationInput('user', 'u@example.com', 'short')).toMatch(/Password must/);
    expect(validateRegistrationInput('user', 'u@example.com', 'lowercase1')).toMatch(/Password must/);
    expect(validateRegistrationInput('user', 'u@example.com', 'NoDigitHere')).toMatch(/Password must/);
  });
  test('accepts valid input', () => {
    expect(validateRegistrationInput('user', 'u@example.com', 'GoodPass1')).toBeUndefined();
  });
});

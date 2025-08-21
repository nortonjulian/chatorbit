import { isPremiumPlan } from '../utils/subscription.js';

describe('isPremiumPlan', () => {
  test('returns false for no plan or FREE', () => {
    expect(isPremiumPlan(null)).toBe(false);
    expect(isPremiumPlan('free')).toBe(false);
    expect(isPremiumPlan('')).toBe(false);
  });
  test('returns true for any other plan', () => {
    expect(isPremiumPlan('basic')).toBe(true);
    expect(isPremiumPlan('PREMIUM')).toBe(true);
    expect(isPremiumPlan('Gold')).toBe(true);
  });
});

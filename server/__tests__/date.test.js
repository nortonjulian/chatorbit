import { formatDate, formatTime, addDays } from '../utils/date.js';

describe('formatDate', () => {
  test('formats a valid date string', () => {
    const date = new Date('2020-01-02T15:30:00Z');
    expect(formatDate(date)).toContain('Jan 2, 2020');  // e.g. "Jan 2, 2020"
  });
  test('returns empty string for invalid date', () => {
    expect(formatTime(new Date('invalid'))).toBe('');
  });
});

describe('formatTime', () => {
  test('formats a valid time', () => {
    const date = new Date('2020-01-02T05:04:00Z');
    expect(formatTime(date)).toMatch(/\d{1,2}:\d{2} (AM|PM)/); // e.g. "12:04 AM"
  });
  test('returns empty string for invalid date', () => {
    expect(formatTime(new Date('invalid'))).toBe('');
  });
});

describe('addDays', () => {
  test('adds days correctly', () => {
    const base = new Date('2020-01-01T00:00:00Z');
    const result = addDays(base, 5);
    const diffDays = Math.round((result - base) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBe(5);
  });
  test('returns null for invalid date', () => {
    expect(addDays('invalid', 5)).toBeNull();
  });
});


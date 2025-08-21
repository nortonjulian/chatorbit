import { asyncHandler } from '../utils/asyncHandler.js';
import { jest } from '@jest/globals';

describe('asyncHandler middleware', () => {
  test('passes error to next()', async () => {
    const req = {}, res = {};
    const error = new Error('fail');
    const fn = async () => { throw error; };
    const next = jest.fn();
    await asyncHandler(fn)(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });
  test('calls function without error', async () => {
    const req = {}, res = {};
    const fn = async (req, res) => { res.done = true; };
    const next = jest.fn();
    await asyncHandler(fn)(req, res, next);
    expect(res.done).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });
});


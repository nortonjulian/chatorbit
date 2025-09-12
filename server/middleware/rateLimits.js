import rateLimit from 'express-rate-limit';

const isLoad = process.env.NODE_ENV === 'loadtest' || process.env.LOADTEST === '1';
const HUGE = 100000;

export const limiterLogin   = rateLimit({ windowMs: 10 * 60 * 1000, max: isLoad ? HUGE : 20,  standardHeaders: true, legacyHeaders: false });
export const limiterRegister= rateLimit({ windowMs: 60 * 60 * 1000,  max: isLoad ? HUGE : 10,  standardHeaders: true, legacyHeaders: false });
export const limiterReset   = rateLimit({ windowMs: 60 * 60 * 1000,  max: isLoad ? HUGE : 5,   standardHeaders: true, legacyHeaders: false });
export const limiterInvites = rateLimit({ windowMs: 10 * 60 * 1000,  max: isLoad ? HUGE : 30,  standardHeaders: true, legacyHeaders: false });
export const limiterAI      = rateLimit({ windowMs: 60 * 1000,       max: isLoad ? HUGE : 20,  standardHeaders: true, legacyHeaders: false });
export const limiterMedia   = rateLimit({ windowMs: 60 * 1000,       max: isLoad ? HUGE : 15,  standardHeaders: true, legacyHeaders: false });
export const limiterGenericMutations = rateLimit({
  windowMs: 60 * 1000,
  max: isLoad ? HUGE : 120,
  standardHeaders: true,
  legacyHeaders: false,
});

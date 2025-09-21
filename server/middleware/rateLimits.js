import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const isLoad = process.env.NODE_ENV === 'loadtest' || process.env.LOADTEST === '1';
const IS_TEST = process.env.NODE_ENV === 'test';
const HUGE = 100000;

/** Prefer authenticated user id; otherwise use the IPv4/IPv6 helper. */
function keyByUserOrIp(req, res) {
  const uid = req.user?.id || req.auth?.id;
  if (uid) return `u:${uid}`;
  return ipKeyGenerator(req, res);
}

const PASS = (_req, _res, next) => next();

// In tests: disable *most* rate limits to avoid interference,
// but keep the SMS invites burst limiter active so one call returns 429.
const RL = (opts) => (IS_TEST ? PASS : rateLimit(opts));
const RL_TEST_SMS = (opts) => (IS_TEST ? rateLimit(opts) : rateLimit(opts));

export const limiterLogin = RL({
  windowMs: 10 * 60 * 1000,
  max: isLoad ? HUGE : 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});

export const limiterRegister = RL({
  windowMs: 60 * 60 * 1000,
  max: isLoad ? HUGE : 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});

export const limiterReset = RL({
  windowMs: 60 * 60 * 1000,
  max: isLoad ? HUGE : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});

export const limiterInvites = RL_TEST_SMS({
  windowMs: 10 * 60 * 1000,
  max: isLoad ? HUGE : 3, // small so the test sees a 429
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});

export const invitesSmsLimiter = RL({
  windowMs: 60 * 60 * 1000,
  max: isLoad ? HUGE : 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});

export const invitesEmailLimiter = RL({
  windowMs: 60 * 60 * 1000,
  max: isLoad ? HUGE : 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});

export const limiterAI = RL({
  windowMs: 60 * 1000,
  max: isLoad ? HUGE : 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});

export const limiterMedia = RL({
  windowMs: 60 * 1000,
  max: isLoad ? HUGE : 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});

export const limiterGenericMutations = RL({
  windowMs: 60 * 1000,
  max: isLoad ? HUGE : 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const isLoad = process.env.NODE_ENV === 'loadtest' || process.env.LOADTEST === '1';
const HUGE = 100000;

/**
 * Prefer authenticated user id; otherwise use the v7-safe IPv4/IPv6 helper.
 * IMPORTANT: pass BOTH (req, res) to ipKeyGenerator so v7's validator is happy.
 */
function keyByUserOrIp(req, res) {
  const uid = req.user?.id || req.auth?.id;
  if (uid) return `u:${uid}`;
  return ipKeyGenerator(req, res); // ✅ handles IPv6 correctly
}

export const limiterLogin = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: isLoad ? HUGE : 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});

export const limiterRegister = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isLoad ? HUGE : 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});

export const limiterReset = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isLoad ? HUGE : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});

export const limiterInvites = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: isLoad ? HUGE : 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});

export const limiterAI = rateLimit({
  windowMs: 60 * 1000,
  max: isLoad ? HUGE : 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});

export const limiterMedia = rateLimit({
  windowMs: 60 * 1000,
  max: isLoad ? HUGE : 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});

export const limiterGenericMutations = rateLimit({
  windowMs: 60 * 1000,
  max: isLoad ? HUGE : 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});

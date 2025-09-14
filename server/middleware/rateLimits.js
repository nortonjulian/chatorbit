import rateLimit from 'express-rate-limit';

const isLoad = process.env.NODE_ENV === 'loadtest' || process.env.LOADTEST === '1';
const HUGE = 100000;
const trustForwarded = process.env.TRUST_FORWARDED_IP === 'true';

function keyGenerator(req) {
  const uid = req.user?.id || req.auth?.id;
  if (uid) return `u:${uid}`;
  const ip = trustForwarded
    ? (req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip)
    : req.ip;
  return `ip:${ip}`;
}

export const limiterLogin = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: isLoad ? HUGE : 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
});
export const limiterRegister = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isLoad ? HUGE : 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
});
export const limiterReset = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isLoad ? HUGE : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
});
export const limiterInvites = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: isLoad ? HUGE : 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
});
export const limiterAI = rateLimit({
  windowMs: 60 * 1000,
  max: isLoad ? HUGE : (Number(process.env.AI_REQS_PER_MIN || 20)),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
});
export const limiterMedia = rateLimit({
  windowMs: 60 * 1000,
  max: isLoad ? HUGE : 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
});
export const limiterGenericMutations = rateLimit({
  windowMs: 60 * 1000,
  max: isLoad ? HUGE : 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
});

import rateLimit from 'express-rate-limit';

export const suggestLimiter = rateLimit({
  windowMs: 10_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
});

export const translateLimiter = rateLimit({
  windowMs: 10_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

import rateLimit from 'express-rate-limit';

/* ---------- Devices (provisioning & ops) ---------- */
export const provisionLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 min
  max: 5,                // link/approve/poll abuse guard
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many provisioning attempts, please try again later.' },
});

export const deviceOpsLimiter = rateLimit({
  windowMs: 10 * 1000,   // 10s
  max: 20,               // list/rename/revoke/heartbeat
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many device operations, slow down.' },
});

/* ---------- AI endpoints ---------- */
export const suggestLimiter = rateLimit({
  windowMs: 10_000,      // 10s
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
});

export const translateLimiter = rateLimit({
  windowMs: 10_000,      // 10s
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

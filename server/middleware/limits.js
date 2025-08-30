import { premiumConfig } from '../config/premiumConfig.js';
import prisma from '../utils/prismaClient.js';

/** Clamp expireSeconds based on plan (use on message-send route). */
export function enforceExpireLimit() {
  return async (req, _res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) return next();

      const me = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      });

      const maxDays =
        me?.plan === 'PREMIUM'
          ? premiumConfig.PREMIUM_EXPIRE_MAX_DAYS
          : premiumConfig.FREE_EXPIRE_MAX_DAYS;

      const maxSeconds = Math.max(0, Number(maxDays) * 24 * 60 * 60);

      if (req.body && typeof req.body.expireSeconds !== 'undefined') {
        const val = Number(req.body.expireSeconds || 0);
        req.body.expireSeconds = Math.min(Math.max(0, val), maxSeconds);
      }
    } catch {
      // non-fatal
    }
    next();
  };
}

/** Throw if FREE user exceeds device limit (call inside device registration). */
export async function assertDeviceLimit(userId) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const maxDevices =
    me?.plan === 'PREMIUM'
      ? premiumConfig.PREMIUM_DEVICE_LIMIT
      : premiumConfig.FREE_DEVICE_LIMIT;

  const count = await prisma.device.count({ where: { userId } });

  if (count >= maxDevices) {
    const err = new Error('Device limit reached');
    err.status = 402; // Payment Required
    err.code = 'PREMIUM_REQUIRED';
    err.detail = 'DEVICE_LIMIT';
    throw err;
  }
}

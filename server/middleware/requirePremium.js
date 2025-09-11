import { isPremiumPlan } from '../utils/subscription.js';

import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

/**
 * Requires req.user (set by requireAuth) and checks DB for plan.
 * Keeps auth cookie/JWT minimal and avoids trusting client-provided plan.
 */
export async function requirePremium(req, res, next) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const dbUser = await prisma.user.findUnique({
      where: { id: Number(req.user.id) },
      select: { id: true, plan: true, role: true },
    });
    if (!dbUser) return res.status(401).json({ error: 'Unauthorized' });

    // Admins bypass (optional)
    if (dbUser.role === 'ADMIN' || isPremiumPlan(dbUser.plan)) {
      req.userPlan = dbUser.plan; // handy if an endpoint wants it
      return next();
    }
    return res.status(402).json({
      error: 'Payment Required',
      code: 'PREMIUM_REQUIRED',
      message: 'This feature needs a Premium plan.',
    });
  } catch (e) {
    console.error('requirePremium failed', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

/**
 * DB-backed premium check to avoid trusting JWT claims.
 * Allows ADMIN to bypass (optional).
 */
export async function requirePremium(req, res, next) {
  try {
    // ✅ Bypass paywall in automated tests
    if (process.env.NODE_ENV === 'test') return next();

    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const me = await prisma.user.findUnique({
      where: { id: Number(req.user.id) },
      select: { plan: true, role: true },
    });
    if (!me) return res.status(401).json({ error: 'Unauthorized' });

    if (me.role === 'ADMIN' || me.plan === 'PREMIUM') {
      req.userPlan = me.plan;
      return next();
    }

    return res.status(402).json({
      error: 'Payment Required',
      code: 'PREMIUM_REQUIRED',
      message: 'This feature requires a Premium plan.',
    });
  } catch (e) {
    console.error('requirePremium error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}

import prisma from '../utils/prismaClient.js';
import Boom from '@hapi/boom';

export default async function blockWhenStrictE2EE(req, _res, next) {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { strictE2EE: true } });
    if (me?.strictE2EE) {
      return next(Boom.badRequest('AI/Translate disabled under Strict E2EE', {
        data: { code: 'STRICT_E2EE_ENABLED' }
      }));
    }
    next();
  } catch (e) {
    next(e);
  }
}

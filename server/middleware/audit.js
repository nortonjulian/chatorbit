export function audit(action, { resource, resourceId, redactor } = {}) {
  // returns a middleware you can place in a route handler chain
  return async (req, res, next) => {
    const startedAt = Date.now();
    const done = () => {
      res.removeListener('finish', done);
      res.removeListener('close', done);

      const status = res.statusCode;
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
      const userAgent = req.get('user-agent') || null;

      // Allow caller to provide redacted metadata builder
      let metadata = undefined;
      try {
        metadata = redactor ? redactor(req, res) : undefined;
      } catch (_) {}

      // Only persist if we have an authenticated actor
      const actorId = req.user?.id;
      if (!actorId) return;

      // Lazy import prisma to avoid cycles
      import('../utils/prismaClient.js').then(({ default: prisma }) => {
        prisma.auditLog.create({
          data: {
            actorId,
            action,
            resource: resource || null,
            resourceId: resourceId?.toString() || null,
            status,
            ip,
            userAgent,
            metadata
          }
        }).catch(() => {});
      });
    };

    res.on('finish', done);
    res.on('close', done);
    next();
  };
}

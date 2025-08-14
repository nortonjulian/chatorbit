import Boom from '@hapi/boom';

export function notFoundHandler(req, res, next) {
  next(Boom.notFound('Route not found'));
}

export function errorHandler(err, req, res, next) {
  // Normalize to Boom error
  const boomErr = Boom.isBoom(err)
    ? err
    : Boom.boomify(err, { statusCode: err.status || err.statusCode || 500 });

  const { statusCode, payload } = boomErr.output;

  // Only log 5xx (unexpected) server errors
  if (statusCode >= 500) {
    // Add route context to logs
    console.error(`[${req.method}] ${req.originalUrl}`, err);
  }

  // Optional: attach structured data (e.g., validation details)
  const body = boomErr.data ? { ...payload, data: boomErr.data } : payload;

  res.status(statusCode).json(body);
}

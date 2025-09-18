import helmet from 'helmet';

export function secureHeaders() {
  return [
    helmet.hidePoweredBy(),
    helmet.xssFilter(), // adds X-XSS-Protection for legacy browsers (noop modern)
    helmet.frameguard({ action: 'deny' }),
    helmet.noSniff(),
    helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }),
    helmet.dnsPrefetchControl({ allow: false }),
    // HSTS only in prod and with TLS/behind proxy
    process.env.NODE_ENV === 'production'
      ? helmet.hsts({ maxAge: 15552000, includeSubDomains: true, preload: false })
      : (req, _res, next) => next(),
  ];
}

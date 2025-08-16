import jwt from 'jsonwebtoken';

// Helper: pull JWT from Authorization: Bearer ... or from an HTTP-only cookie
function getTokenFromReq(req) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;

  const cookieName = process.env.JWT_COOKIE_NAME || 'orbit_jwt';
  const cookieToken = req.cookies?.[cookieName] || null;

  return bearer || cookieToken || null;
}

export function verifyToken(req, res, next) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      // Your server bootstrap should already assert this, but guard here too.
      return res.status(500).json({ error: 'Server misconfiguration (JWT secret missing)' });
    }

    const decoded = jwt.verify(token, secret);
    req.user = decoded; // { id, username, role, ... }
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Softer version: attaches req.user if present/valid; otherwise continues.
// Useful for logout endpoints or routes that behave differently when signed in.
export function verifyTokenOptional(req, _res, next) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return next();

    const secret = process.env.JWT_SECRET;
    if (!secret) return next();

    req.user = jwt.verify(token, secret);
  } catch {
    // ignore invalid/expired tokens in optional mode
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

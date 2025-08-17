import jwt from 'jsonwebtoken';

/** Centralized cookie config/name */
function getCookieName() {
  return process.env.JWT_COOKIE_NAME || 'orbit_jwt';
}

/**
 * Returns the JWT string from (1) cookie [preferred],
 * or (2) Authorization: Bearer ... if you explicitly allow it.
 */
function getTokenFromReq(req, { allowBearer = false } = {}) {
  // 1) Cookie (preferred)
  const cookieToken = req.cookies?.[getCookieName()] || null;
  if (cookieToken) return cookieToken;

  // 2) Optional Bearer header (handy for tools; disable by default)
  if (allowBearer) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) return header.slice(7);
  }

  return null;
}

/** Strict auth: requires a valid JWT; attaches `req.user = { id, username, role }` */
export function requireAuth(req, res, next) {
  try {
    const token = getTokenFromReq(req, { allowBearer: false });
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'Server misconfiguration (JWT secret missing)' });
    }

    const decoded = jwt.verify(token, secret);
    // Expecting payload like: { id, username, role }
    if (!decoded?.id) return res.status(401).json({ error: 'Unauthorized' });

    req.user = { id: decoded.id, username: decoded.username, role: decoded.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

/** Soft auth: sets req.user if token is valid; otherwise continues */
export function verifyTokenOptional(req, _res, next) {
  try {
    const token = getTokenFromReq(req, { allowBearer: false });
    const secret = process.env.JWT_SECRET;
    if (!token || !secret) return next();

    const decoded = jwt.verify(token, secret);
    if (decoded?.id) {
      req.user = { id: decoded.id, username: decoded.username, role: decoded.role };
    }
  } catch {
    // ignore invalid/expired tokens
  }
  next();
}

/** Admin gate: requires req.user.role === 'ADMIN'. Use after requireAuth */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

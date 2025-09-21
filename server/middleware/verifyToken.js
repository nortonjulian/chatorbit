import jwt from 'jsonwebtoken';

const SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'test' ? 'test_secret' : 'dev_secret');

function getCookieName() {
  return process.env.JWT_COOKIE_NAME || 'orbit_jwt';
}

export default function verifyToken(req, res, next) {
  // Accept either Authorization: Bearer <jwt> OR the auth cookie
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const cookieTok = req.cookies?.[getCookieName()] || null;
  const token = bearer || cookieTok;

  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded; // typically { id, username, role, plan }
    next();
  } catch (_err) {
    res.status(403).json({ message: 'Invalid token' });
  }
}

import jwt from 'jsonwebtoken';
import cookie from 'cookie';

const COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'orbit_jwt';
const JWT_SECRET = process.env.JWT_SECRET;

export function cookieSocketAuth(io) {
  io.use((socket, next) => {
    try {
      // Parse cookies off the WS upgrade request
      const raw = socket.request.headers.cookie || '';
      const cookies = cookie.parse(raw || '');

      const token = cookies[COOKIE_NAME];
      if (!token) return next(new Error('Unauthorized'));

      const payload = jwt.verify(token, JWT_SECRET); // { id, username, role }
      socket.user = {
        id: payload.id,
        username: payload.username,
        role: payload.role,
      };
      return next();
    } catch (e) {
      return next(new Error('Unauthorized'));
    }
  });
}

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.FILE_TOKEN_SECRET =
  process.env.FILE_TOKEN_SECRET || 'file_token_secret_for_tests';

// keep cors/helmet happy in tests
process.env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5173';

// keep cookies simple in tests
process.env.JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'orbit_jwt';
process.env.COOKIE_SECURE = process.env.COOKIE_SECURE || 'false';
process.env.COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || 'Lax';

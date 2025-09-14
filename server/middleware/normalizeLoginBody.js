export function normalizeLoginBody(req, _res, next) {
  const b = req.body || {};
  const identifier =
    (b.identifier ?? b.username ?? b.email ?? '').toString().trim();

  req.body = {
    identifier,
    password: (b.password ?? '').toString(),
  };
  next();
}

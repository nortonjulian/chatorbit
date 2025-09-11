export const requireAuth = (req, _res, next) => {
  const headerId = req.headers['x-test-user-id'];
  const id = headerId ? Number(headerId) : 1;
  req.user = req.user || { id, role: 'USER', plan: 'FREE' };
  next();
};
export default { requireAuth };

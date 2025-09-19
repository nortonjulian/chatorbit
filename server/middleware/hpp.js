/**
 * Minimal HTTP Parameter Pollution guard for querystrings.
 * Collapses repeated keys (e.g., ?a=1&a=2) to the first value, unless whitelisted.
 *
 * NOTE:
 * - This version intentionally ONLY touches req.query so it is safe to run early.
 * - If you want to normalize req.body as well, mount this AFTER express.json().
 *
 * @param {Object} options
 * @param {string[]} options.allow - keys allowed to remain arrays
 */
export function hppGuard({ allow = [] } = {}) {
  const allowSet = new Set(allow);
  return function hppMiddleware(req, _res, next) {
    const q = req.query || {};
    for (const [key, val] of Object.entries(q)) {
      if (Array.isArray(val) && !allowSet.has(key)) {
        q[key] = val[0];
      }
    }
    next();
  };
}

export default hppGuard;

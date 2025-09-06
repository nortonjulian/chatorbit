// Toggle verbose request logging: ARTY_VERBOSE=1 npx artillery run ...
const VERBOSE = process.env.ARTY_VERBOSE === '1';

/* --------------------------------
 * Small utils
 * -------------------------------- */
function first(v) { return Array.isArray(v) ? v[0] : v; }

function extractJwt(setCookie, cookieName = 'orbit_jwt') {
  const one = first(setCookie);
  if (!one) return '';
  const m = String(one).match(new RegExp(`${cookieName}=([^;]+)`));
  return m ? m[1] : '';
}

/* --------------------------------
 * Per-VU seeding
 * (ctx, ee, next)
 * -------------------------------- */
function seedVars(ctx, _ee, next) {
  ctx.vars = ctx.vars || {};
  if (!ctx.vars._rand) ctx.vars._rand = Math.random().toString(36).slice(2);
  const uname = `u_${ctx.vars._rand}`;
  ctx.vars.uname = uname;
  ctx.vars.email = `${uname}@example.com`;
  ctx.vars.password = 'Secr3t!234567';
  return next();
}

/* --------------------------------
 * Debug helper for 4xx/5xx
 * (req, res, ctx, ee, next)
 * -------------------------------- */
function debugOnError(req, res, _ctx, _ee, next) {
  const method = req?.method || '??';
  const url = (req && (req.url || req.uri)) || '??';
  if (res.statusCode >= 400) {
    console.error(
      `[Artillery debug] ${method} ${url} -> ${res.statusCode}\n` +
      `Headers: ${JSON.stringify(res.headers)}\n` +
      `Body: ${res.body}`
    );
  }
  return next();
}

/* --------------------------------
 * After login: capture JWT cookie
 * (req, res, ctx, ee, next)
 * -------------------------------- */
function afterLoginHook(req, res, ctx, ee, next) {
  debugOnError(req, res, ctx, ee, () => {});
  if (res.statusCode === 200) {
    const token = extractJwt(
      res.headers?.['set-cookie'],
      process.env.JWT_COOKIE_NAME || 'orbit_jwt'
    );
    if (token) ctx.vars.jwt = token;
  }
  return next();
}

/* --------------------------------
 * BEFORE REQUEST hooks
 * -------------------------------- */

/** Seed username/email into /auth/register body
 * (req, ctx, ee, next)
 */
function seedUsername(req, ctx, _ee, next) {
  // ensure vars exist
  ctx.vars = ctx.vars || {};
  if (!ctx.vars._rand) ctx.vars._rand = Math.random().toString(36).slice(2);
  ctx.vars.uname = ctx.vars.uname || `u_${ctx.vars._rand}`;
  ctx.vars.email = ctx.vars.email || `${ctx.vars.uname}@example.com`;
  ctx.vars.password = ctx.vars.password || 'Secr3t!234567';

  try {
    const isRegister = req && (req.url || req.uri) && String(req.url || req.uri).includes('/auth/register');
    const bodyObj = req?.json ?? (req?.body ? JSON.parse(req.body) : null);
    if (isRegister && bodyObj) {
      bodyObj.username = ctx.vars.uname;
      bodyObj.email = ctx.vars.email;       // valid email to avoid 400
      bodyObj.password = ctx.vars.password;
      if (req.json) req.json = bodyObj; else req.body = JSON.stringify(bodyObj);
    }
  } catch (_e) {
    // swallow; Artillery will still send original body
  }
  return next();
}

/** Ensure login uses seeded vars
 * (req, ctx, ee, next)
 */
function patchLoginWithSeed(req, ctx, _ee, next) {
  try {
    const isLogin = req && (req.url || req.uri) && String(req.url || req.uri).includes('/auth/login');
    const bodyObj = req?.json ?? (req?.body ? JSON.parse(req.body) : null);
    if (isLogin && bodyObj) {
      bodyObj.username = ctx.vars?.uname || bodyObj.username;
      bodyObj.password = ctx.vars?.password || bodyObj.password;
      if (req.json) req.json = bodyObj; else req.body = JSON.stringify(bodyObj);
    }
  } catch (_e) {}
  return next();
}

/** Verbose log of JSON body (uses req.json if present)
 * (req, ctx, ee, next)
 */
function logJson(req, ctx, _ee, next) {
  if (!VERBOSE) return next();

  // Prefer the object form if Artillery gives us req.json
  let obj = req?.json;
  if (!obj) {
    try { obj = req?.body ? JSON.parse(req.body) : undefined; } catch (_e) {}
  }

  // Best-effort interpolation preview if placeholders still present
  const preview = { ...(obj || {}) };
  if (preview.username === '{{ uname }}' && ctx?.vars?.uname) preview.username = ctx.vars.uname;
  if (preview.email === '{{ email }}' && ctx?.vars?.email) preview.email = ctx.vars.email;
  if (preview.password === '{{ password }}' && ctx?.vars?.password) preview.password = ctx.vars.password;

  console.log('[Artillery] sending JSON:', JSON.stringify(preview || obj || {}));
  return next();
}

/** Attach auth header/cookie if we captured a token
 * (req, ctx, ee, next)
 */
function attachAuth(req, ctx, _ee, next) {
  // If you use cookie auth
  if (ctx.vars.jwt) {
    req.headers = req.headers || {};
    req.headers.Cookie = `orbit_jwt=${ctx.vars.jwt}`;
  }
  // If you use bearer, uncomment:
  // if (ctx.vars.jwt) {
  //   req.headers = req.headers || {};
  //   req.headers.Authorization = `Bearer ${ctx.vars.jwt}`;
  // }
  return next();
}

/* --------------------------------
 * AFTER RESPONSE hooks
 * -------------------------------- */

/** Capture JWT cookie after login (optional)
 * (req, res, ctx, ee, next)
 */
function extractJwtAfterLogin(_req, res, ctx, _ee, next) {
  if (res.statusCode !== 200) return next();
  const token = extractJwt(
    res.headers?.['set-cookie'],
    process.env.JWT_COOKIE_NAME || 'orbit_jwt'
  );
  if (token) ctx.vars.jwt = token;
  return next();
}

/** Optionally capture username from /auth/me
 * (req, res, ctx, ee, next)
 */
function captureFromMe(_req, res, ctx, _ee, next) {
  try {
    if (res.statusCode === 200) {
      const data = JSON.parse(res.body || '{}');
      const uname = data?.user?.username;
      if (uname) ctx.vars.meUsername = uname;
    }
  } catch (_e) {}
  return next();
}

/** Respect 429 Retry-After to avoid hammering
 * (req, res, ctx, ee, next)
 */
function respectRetryAfter(_req, res, _ctx, _ee, next) {
  if (res && res.statusCode === 429) {
    const hdr = res.headers?.['retry-after'];
    const seconds = Number(hdr) > 0 ? Number(hdr) : 1;
    return setTimeout(next, seconds * 1000);
  }
  return next();
}

/* --------------------------------
 * Sanity check step
 * (ctx, ee, next)
 * -------------------------------- */
function ensureVars(ctx, _ee, next) {
  // Match whatever your YAML expects; update if needed
  const mustHave = ['userId', 'userPlan', 'wsToken'];
  const missing = mustHave.filter((k) => !ctx.vars[k]);
  if (missing.length) return next(new Error(`Missing vars: ${missing.join(', ')}`));
  return next();
}

/* --------------------------------
 * Exports
 * -------------------------------- */
module.exports = {
  // main utilities
  seedVars,
  debugOnError,
  ensureVars,
  afterLoginHook,

  // beforeRequest
  seedUsername,
  patchLoginWithSeed,
  logJson,
  attachAuth,

  // afterResponse
  extractJwtAfterLogin,
  captureFromMe,
  respectRetryAfter,
};

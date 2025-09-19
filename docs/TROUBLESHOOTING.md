# Troubleshooting

## Login “CSRF token missing/invalid”
- Ensure the client calls `GET /auth/csrf` on app start (your `primeCsrf()` already does this).
- In development, check the Vite proxy is forwarding cookies and that `FRONTEND_ORIGIN` and `CORS_ORIGINS` include `http://localhost:5173`.

## 401 after login
- Cookies blocked by the browser? If using Chrome, disable “Block third-party cookies” for localhost.
- Confirm `COOKIE_SECURE=false` for http dev and that `COOKIE_DOMAIN` is not set incorrectly.

## Prisma errors / database connection
- Check `DATABASE_URL`. Run `npx prisma migrate dev` in `/server`.
- If using Docker Postgres, ensure port 5432 is open and reachable.

## Uploads rejected
- File too large → see `MAX_FILE_SIZE_BYTES` limit in upload middleware.
- MIME/extension disallowed → see `server/middleware/upload.js` allowlist.

## SMS/email invites fail
- Missing provider credentials (Telnyx/Bandwidth/SMTP). In dev, email falls back to Ethereal; check console for preview URL.

## Socket.IO not cross-tab
- Configure `REDIS_URL` to enable Redis adapter if running multiple server instances or using serverless/PM2 clusters.

## Stripe webhook signature
- In dev set `STRIPE_SKIP_SIG_CHECK=true`. In prod, remove that and set `STRIPE_WEBHOOK_SECRET`.

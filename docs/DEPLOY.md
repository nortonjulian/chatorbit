# Deploying Chatforia

## Environments
- **Database**: Managed Postgres (Render, Supabase, RDS, etc.)
- **Redis** (optional): For Socket.IO adapter & rate limit stores.
- **Storage**: Local disk or S3-compatible (R2/S3) for uploads.

## Server
- Set env from `server/.env.example`.
- Run migrations: `npx prisma migrate deploy`.
- Start: `node dist/index.js` (Dockerfile already does this).

## Client
- Set `VITE_API_URL` to your server URL.
- Build: `npm run build` (served via nginx in the provided Dockerfile).

## Webhooks
- Stripe: expose `/billing/webhook` with **raw body**. Add secret to env.
- Telnyx/Bandwidth: point SMS webhooks to `/webhooks/sms/telnyx` or `/webhooks/sms/bandwidth`.

## Security
- Enforce HTTPS at the proxy (HSTS).
- Set `COOKIE_SECURE=true` and proper `COOKIE_DOMAIN` for production.
- Keep `JWT_SECRET` strong and rotated as needed.

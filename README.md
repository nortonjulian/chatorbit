# Chatforia

🚀 **Chatforia** is a modern full-stack messaging app designed for **real-time conversations**, **secure communication**, and **global reach**.  
Built as a monorepo (client + server), it supports text, voice, video, media sharing, call/text forwarding, premium subscriptions, and more.

---

## ✨ Features

### Core Messaging
- Real-time chat with WebSockets (Socket.IO).
- Chatrooms, 1:1, and group chats.
- Media uploads (images, audio, video).
- Inline translation (Google/DeepL) with per-user language preferences.
- Message editing, deletion, read receipts, and disappearing messages.
- Contact management (save users, assign aliases, start chats quickly).

### Security & Privacy
- Hybrid **end-to-end encryption** (per-user session keys).
- Configurable read receipts & disappearing messages.
- Background job auto-deletes expired messages.
- File upload scanning (antivirus) + MIME/size limits.
- bcrypt password hashing + JWT auth.

### Calling & Forwarding
- In-app video/voice calls with modern UI.
- **Call forwarding**: route Chatforia calls → external numbers (with quiet hours).
- **Text forwarding**: forward SMS → phone number or email.
- Alias dialer: make outbound calls using your Chatforia number.

### Premium Features
- Premium-only routes/pages (`RequirePremium` guard).
- Unlock backups, ad-free sidebar, call/text forwarding, and more.

### Status & Social
- Status feed (like stories) with audience controls:
  - Public / Followers / Contacts / Mutuals / Custom lists.
- Expiry controls per status post.
- File attachments supported.

### Accessibility & UX
- Screen-reader announcer (`A11yAnnouncer`).
- Skip-to-content, aria-labels, visible focus rings.
- Keyboard-friendly: escape closes modals, enter can send messages.
- Lighthouse a11y checks pass baseline.

### Admin
- User management, reports, and audit logs.
- Role-based admin route guard.

### Ads & Monetization
- Sidebar ad slots for free-tier users.
- Premium = ad-free.

## 📸 Screenshots

![Chat UI](docs/images/chat.png)
![Video Call](docs/images/call.png)
![Status Feed](docs/images/status.png)

---

## 🏗️ Tech Stack

**Frontend (client):**
- React (Vite) + Mantine UI + Tailwind utilities.
- React Router v6.
- Jest + RTL for unit tests, Playwright for E2E.

**Backend (server):**
- Node.js + Express.
- Prisma ORM + PostgreSQL.
- Socket.IO for realtime.
- Multer + ClamAV (uploads).
- Pino (logging) + Sentry (error tracking).
- Stripe integration (billing).
- Telnyx + Bandwidth (SMS/calls).

**Infra:**
- PostgreSQL locally + managed in staging/prod.
- CI/CD with GitHub Actions + Render.
- Secrets/vars set via GitHub Actions → Environments.

---

## ⚙️ Prerequisites

Before running, install:

- [Node.js v20+](https://nodejs.org/)
- npm v9+ (ships with Node)
- [PostgreSQL v14+](https://www.postgresql.org/)
- (Optional) [Redis](https://redis.io/) for caching/queues
- (Optional) [ClamAV](https://www.clamav.net/) for antivirus on uploads

---

## 🚀 Getting Started

Clone and install:

```bash
# Clone
git clone https://github.com/nortonjulian/chatforia.git
cd chatforia

# Install deps
npm ci

# Setup database
cd server
npx prisma migrate dev


## 📜 License

Proprietary – all rights reserved.  
Contact Chatforia for licensing or usage.

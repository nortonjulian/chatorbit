# ChatOrbit

🚀 **ChatOrbit** is a modern full-stack messaging app designed for **real-time conversations**, **secure communication**, and **global reach**. Built as a monorepo (client + server), it supports text, voice, video, media sharing, and advanced features like end-to-end encryption, call/text forwarding, premium subscriptions, and more.

---

## ✨ Features

### Core Messaging
- Real-time chat with WebSockets (Socket.IO).
- Chatrooms, 1:1 messages, and group chats.
- Support for media uploads (images, audio, video).
- Inline translation (Google/DeepL) with user language preferences.
- Message editing, deletion, read receipts, and disappearing messages.
- Contact management: save users, assign aliases, quick-start chats.

### Security & Privacy
- Hybrid **end-to-end encryption** (per-user session keys).
- Optional **read receipts** and disappearing messages (configurable).
- Background job auto-deletes expired messages.
- Upload scanning (antivirus) + strict file type/size limits.
- Session-aware login/logout with bcrypt + JWT auth.

### Calling & Forwarding
- Video/voice calls with in-app call UI.
- **Call Forwarding:** route calls from ChatOrbit numbers to external phone numbers (with quiet hours).
- **Text Forwarding:** receive SMS in-app and optionally forward to a phone number or email.
- Alias dialer: place outbound calls from your ChatOrbit number.

### Premium Features
- Premium-only pages & features gated with `RequirePremium`.
- Premium plans unlock backups, ad-free sidebar, forwarding, and more.

### Status & Social
- Status feed (like stories) with audience controls:
  - Public / Followers / Contacts / Mutuals / Custom lists.
- Expiry controls for status posts.
- File attachments in statuses.

### Accessibility & UX
- Global screen-reader announcer (`A11yAnnouncer`).
- Skip-to-content, proper aria-labels, focus rings.
- Keyboard-friendly: escape closes modals, enter can send messages.
- Lighthouse a11y checks pass basic requirements.

### Admin
- User, reports, and audit logs management via admin pages.
- Role-based admin route guard.

### Ads & Monetization
- Configurable ad slots for free-tier users (sidebar, etc).
- Premium users see ad-free experience.

---

## 🏗️ Tech Stack

### Frontend (client/)
- React (Vite) + Mantine UI + Tailwind utilities.
- React Router v6.
- State with React context/hooks.
- Testing: Jest, React Testing Library, Playwright (E2E).

### Backend (server/)
- Node.js + Express.
- Prisma ORM + PostgreSQL.
- Socket.IO for real-time.
- Secure uploads with Multer + scanning.
- Pino for logging; Sentry for error tracking.
- Stripe integration (subscriptions/payments).
- Telnyx/Bandwidth integration for calls + SMS.

### Infra
- PostgreSQL (local in dev, managed in staging/prod).
- CI/CD with GitHub Actions + Render.
- Secrets & variables configured via GitHub Actions → Environments.

---

## 📂 Project Structure


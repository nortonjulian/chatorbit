import express from 'express';
import Boom from '@hapi/boom';
import verifyToken from '../middleware/verifyToken.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// SMS providers
import telnyx from 'telnyx';
import Bandwidth from '@bandwidth/messaging';

// Mailer (singleton transporter you configure in services/mailer.js)
import { transporter } from '../services/mailer.js';

// ✅ New: invite/date utils
import { formatDate, formatTime } from '../utils/date.js';
import { createInviteTemplate } from '../utils/inviteTemplate.js';

const router = express.Router();

const {
  INVITES_PROVIDER, // 'telnyx' | 'bandwidth'
  APP_DOWNLOAD_URL,

  // Telnyx
  TELNYX_API_KEY,
  TELNYX_MESSAGING_PROFILE_ID, // OR use a specific number as "from"
  TELNYX_FROM_NUMBER, // optional: if you prefer a fixed from number

  // Bandwidth
  BANDWIDTH_ACCOUNT_ID,
  BANDWIDTH_USER_ID,
  BANDWIDTH_PASSWORD,
  BANDWIDTH_MESSAGING_APPLICATION_ID,
  BANDWIDTH_FROM_NUMBER,

  // Email
  MAIL_FROM, // e.g. 'noreply@chatorbit.app'
  APP_ORIGIN, // e.g. 'https://app.chatorbit.com'
} = process.env;

const normalize = (s) => (s || '').toString().replace(/[^\d+]/g, '');

// --- Provider clients (init if configured) ---
const tx = TELNYX_API_KEY ? telnyx(TELNYX_API_KEY) : null;

const bwClient =
  BANDWIDTH_ACCOUNT_ID && BANDWIDTH_USER_ID
    ? new Bandwidth.Client({
        basicAuthUserName: BANDWIDTH_USER_ID,
        basicAuthPassword: BANDWIDTH_PASSWORD,
      })
    : null;

// --- Send via Telnyx ---
async function sendViaTelnyx({ to, text }) {
  if (!tx) throw Boom.preconditionFailed('Telnyx not configured');
  const from = TELNYX_FROM_NUMBER || TELNYX_MESSAGING_PROFILE_ID;
  if (!from)
    throw Boom.preconditionFailed(
      'Missing TELNYX_MESSAGING_PROFILE_ID or TELNYX_FROM_NUMBER'
    );

  try {
    await tx.messages.create({
      from, // Messaging Profile ID or E.164 number
      to,
      text,
    });
  } catch (err) {
    throw Boom.badGateway(
      `Telnyx send failed: ${err?.message || 'unknown error'}`,
      {
        provider: 'telnyx',
        cause: err,
      }
    );
  }
}

// --- Send via Bandwidth ---
async function sendViaBandwidth({ to, text }) {
  if (!bwClient) throw Boom.preconditionFailed('Bandwidth not configured');
  if (
    !BANDWIDTH_ACCOUNT_ID ||
    !BANDWIDTH_MESSAGING_APPLICATION_ID ||
    !BANDWIDTH_FROM_NUMBER
  ) {
    throw Boom.preconditionFailed('Missing Bandwidth messaging configuration');
  }

  try {
    await bwClient.createMessage({
      accountId: BANDWIDTH_ACCOUNT_ID,
      applicationId: BANDWIDTH_MESSAGING_APPLICATION_ID,
      to: [to],
      from: BANDWIDTH_FROM_NUMBER,
      text,
    });
  } catch (err) {
    throw Boom.badGateway(
      `Bandwidth send failed: ${err?.message || 'unknown error'}`,
      {
        provider: 'bandwidth',
        cause: err,
      }
    );
  }
}

// --- Helper: choose provider with fallback ---
async function sendSmsWithFallback({ to, text, preferred }) {
  // Optional: smart routing (e.g., use Bandwidth for +1)
  // const useBandwidth = to.startsWith('+1');
  // const pref = preferred || (useBandwidth ? 'bandwidth' : 'telnyx');

  const pref = (preferred || INVITES_PROVIDER || 'telnyx').toLowerCase();
  const primary = pref === 'bandwidth' ? sendViaBandwidth : sendViaTelnyx;
  const fallback = pref === 'bandwidth' ? sendViaTelnyx : sendViaBandwidth;

  try {
    await primary({ to, text });
  } catch (primaryErr) {
    try {
      await fallback({ to, text });
    } catch (fallbackErr) {
      // Surface a single, clear upstream failure
      throw Boom.badGateway('Failed to send invite via any SMS provider', {
        primary: { provider: pref, message: primaryErr?.message },
        fallback: {
          provider: pref === 'bandwidth' ? 'telnyx' : 'bandwidth',
          message: fallbackErr?.message,
        },
      });
    }
  }
}

// --- POST /invites (SMS) ---
router.post(
  '/',
  verifyToken,
  asyncHandler(async (req, res) => {
    const { phone, message, preferredProvider } = req.body || {};
    if (!phone) throw Boom.badRequest('phone is required');

    const inviter = req.user?.username || 'A friend';

    // You can keep your short SMS or use formatted date/time if useful.
    // Here we keep it short & simple for carriers:
    const text =
      (message && message.toString().trim()) ||
      `${inviter} invited you to try ChatOrbit. Download here: ${APP_DOWNLOAD_URL || ''}`;

    const to = normalize(phone);
    if (!to) throw Boom.badRequest('Invalid phone');

    await sendSmsWithFallback({ to, text, preferred: preferredProvider });
    return res.json({ sent: true });
  })
);

// --- POST /invites/email ---
router.post(
  '/email',
  verifyToken,
  asyncHandler(async (req, res) => {
    if (!transporter)
      throw Boom.preconditionFailed('Email transporter not configured');

    const { to, roomId, subject, html, text } = req.body || {};

    // Accept string or array for "to"
    const recipients = Array.isArray(to) ? to : to ? [to] : [];
    if (!recipients.length) throw Boom.badRequest('to is required');

    // Build a join URL if a roomId is provided
    const joinUrlBase = (APP_ORIGIN || 'http://localhost:5173').replace(
      /\/+$/,
      ''
    );
    const joinUrl = roomId
      ? `${joinUrlBase}/join/${encodeURIComponent(String(roomId))}`
      : null;

    const inviter = req.user?.username || 'A friend';

    // ✅ Use utils to format a friendly "event" feel (optional)
    const now = new Date();
    const eventDate = formatDate(now); // e.g., "Aug 13, 2025"
    const eventTime = formatTime(now); // e.g., "02:30 PM"

    // If caller supplies subject/html/text, we honor them; otherwise we render a tidy default
    const outSubject =
      subject ||
      (joinUrl ? 'Join me on ChatOrbit' : 'You’ve been invited to ChatOrbit');

    const outHtml =
      html ||
      createInviteTemplate({
        eventName: 'ChatOrbit chat',
        eventDate,
        eventTime,
        location: 'Online',
        hostName: inviter,
        joinLink: joinUrl || APP_DOWNLOAD_URL || '',
      });

    const outText =
      text ||
      [
        `${inviter} invited you to ChatOrbit.`,
        joinUrl ? `Join: ${joinUrl}` : null,
        APP_DOWNLOAD_URL ? `Download: ${APP_DOWNLOAD_URL}` : null,
      ]
        .filter(Boolean)
        .join('\n');

    const info = await transporter.sendMail({
      from: MAIL_FROM || 'noreply@chatorbit.app',
      to: recipients,
      subject: outSubject,
      html: outHtml,
      text: outText,
    });

    return res
      .status(202)
      .json({ ok: true, sent: recipients.length, messageId: info?.messageId });
  })
);

export default router;

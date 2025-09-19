import express from 'express';
import Boom from '@hapi/boom';
import verifyToken from '../middleware/verifyToken.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { transporter } from '../services/mailer.js';
import { formatDate, formatTime } from '../utils/date.js';
import { createInviteTemplate } from '../utils/inviteTemplate.js';
import { sendSmsWithFallback } from '../lib/telco/index.js';
import {
  limiterInvites,        // your existing 10-min burst limiter
  invitesSmsLimiter,     // add these in rateLimits.js if you haven’t yet
  invitesEmailLimiter,   // (see earlier step)
} from '../middleware/rateLimits.js';

const router = express.Router();

const {
  INVITES_PROVIDER,   // optional: default preferred provider ('telnyx' | 'bandwidth')
  APP_DOWNLOAD_URL,
  MAIL_FROM,
  APP_ORIGIN,
} = process.env;

/* ------------ helpers ------------ */
function normalizeE164(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  const digits = s.replace(/[^\d+]/g, '');
  if (!/^\+?[1-9]\d{7,14}$/.test(digits)) return null;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function coerceRecipients(to) {
  if (Array.isArray(to)) return to.filter(isValidEmail);
  if (isValidEmail(to)) return [to];
  return [];
}

function capMsg(s, max = 480) {
  if (!s) return '';
  const clean = String(s).replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/* ------------ SMS INVITES ------------ */
router.post(
  '/',
  verifyToken,
  limiterInvites,        // 10-min burst
  invitesSmsLimiter,     // per-user hourly
  express.json(),
  asyncHandler(async (req, res) => {
    const { phone, message, preferredProvider } = req.body || {};

    // basic presence
    if (!phone) throw Boom.badRequest('phone is required');

    // phone normalize + validate
    const to = normalizeE164(phone);
    if (!to) throw Boom.badRequest('Invalid phone');

    // self-invite guard if user has a phone number on file
    const myPhone = normalizeE164(req.user?.phoneNumber);
    if (myPhone && myPhone === to) {
      throw Boom.badRequest('Cannot invite your own number');
    }

    // message
    const inviter = req.user?.username || 'A friend';
    const text = capMsg(
      (message && message.toString()) ||
      `${inviter} invited you to try ChatOrbit. Download here: ${APP_DOWNLOAD_URL || ''}`
    );

    // provider hint
    const pref = String(preferredProvider || INVITES_PROVIDER || '').toLowerCase();
    const preferred =
      pref === 'telnyx' || pref === 'bandwidth' ? pref : undefined;

    const clientRef = `invite:${req.user?.id || 'anon'}:${Date.now()}`;

    try {
      const result = await sendSmsWithFallback({
        to,
        text,
        clientRef,
        preferred,
      });
      console.info('[invite_sms_sent]', {
        userId: req.user?.id, to, provider: result.provider, id: result.messageId,
      });
      return res.json({ sent: true, provider: result.provider, id: result.messageId });
    } catch (err) {
      console.warn('[invite_sms_failed]', {
        userId: req.user?.id, to, err: err?.message,
      });
      throw Boom.badGateway('Failed to send invite');
    }
  })
);

/* ------------ EMAIL INVITES ------------ */
router.post(
  '/email',
  verifyToken,
  limiterInvites,        // 10-min burst
  invitesEmailLimiter,   // per-user hourly
  express.json(),
  asyncHandler(async (req, res) => {
    if (!transporter) throw Boom.preconditionFailed('Email transporter not configured');

    const { to, roomId, subject, html, text } = req.body || {};

    // validate recipients
    const recipients = coerceRecipients(to);
    if (recipients.length === 0) {
      throw Boom.badRequest('Valid "to" is required (email or array of emails)');
    }

    // self-invite guard if user email is present
    const myEmail = String(req.user?.email || '').toLowerCase();
    if (myEmail && recipients.some(r => r.toLowerCase() === myEmail)) {
      throw Boom.badRequest('Cannot invite your own email');
    }

    const joinUrlBase = (APP_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '');
    const joinUrl = roomId ? `${joinUrlBase}/join/${encodeURIComponent(String(roomId))}` : null;

    const inviter = req.user?.username || 'A friend';
    const now = new Date();
    const eventDate = formatDate(now);
    const eventTime = formatTime(now);

    const outSubject = capMsg(subject || (joinUrl ? 'Join me on ChatOrbit' : 'You’ve been invited to ChatOrbit'), 120);
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
      capMsg(
        text ||
          [
            `${inviter} invited you to ChatOrbit.`,
            joinUrl ? `Join: ${joinUrl}` : null,
            APP_DOWNLOAD_URL ? `Download: ${APP_DOWNLOAD_URL}` : null,
          ]
            .filter(Boolean)
            .join('\n')
      );

    try {
      const info = await transporter.sendMail({
        from: MAIL_FROM || 'noreply@chatorbit.app',
        to: recipients,
        subject: outSubject,
        html: outHtml,
        text: outText,
      });
      console.info('[invite_email_sent]', {
        userId: req.user?.id, recipients, messageId: info?.messageId,
      });
      return res.status(202).json({ ok: true, sent: recipients.length, messageId: info?.messageId || null });
    } catch (err) {
      console.warn('[invite_email_failed]', {
        userId: req.user?.id, recipients, err: err?.message,
      });
      throw Boom.badGateway('Failed to send email invite');
    }
  })
);

export default router;

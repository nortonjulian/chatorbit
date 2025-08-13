import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import * as chrono from 'chrono-node';
import { DateTime } from 'luxon';
import { createEvent } from 'ics';
import nodemailer from 'nodemailer';

const router = express.Router();

// POST /calendar/parse  -> { events: [{startISO,endISO,text,isAllDay}] }
router.post('/parse', verifyToken, (req, res) => {
  const { text, referenceISO } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text is required' });

  const ref = referenceISO ? new Date(referenceISO) : new Date();
  const results = chrono.parse(text, ref, { forwardDate: true });

  const events = results.map((r) => {
    const start = r.start?.date();
    // default to +1h if no end detected
    const end = r.end?.date() || DateTime.fromJSDate(start).plus({ hours: 1 }).toJSDate();
    const isAllDay = !r.start.isCertain('hour');
    return {
      text: r.text,
      startISO: DateTime.fromJSDate(start).toUTC().toISO(),
      endISO: DateTime.fromJSDate(end).toUTC().toISO(),
      isAllDay,
    };
  });

  return res.json({ events });
});

// POST /calendar/ics  -> attachment download (or JSON if ?inline=1)
router.post('/ics', verifyToken, (req, res) => {
  const { title, description, location, startISO, endISO } = req.body || {};
  if (!title || !startISO || !endISO) {
    return res.status(400).json({ error: 'title, startISO, endISO required' });
  }

  const start = DateTime.fromISO(startISO).toUTC();
  const end = DateTime.fromISO(endISO).toUTC();

  const event = {
    title,
    description: description || '',
    location: location || '',
    start: [start.year, start.month, start.day, start.hour, start.minute],
    end: [end.year, end.month, end.day, end.hour, end.minute],
    startInputType: 'utc',
    productId: 'ChatOrbit',
    method: 'PUBLISH',
  };

  createEvent(event, (err, ics) => {
    if (err) return res.status(500).json({ error: 'Failed to create ICS' });

    if (req.query.inline === '1') {
      return res.json({ ics });
    }
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="event.ics"');
    return res.send(ics);
  });
});

// POST /calendar/email-invite  { to: string[], title, startISO, endISO, description?, location? }
router.post('/email-invite', verifyToken, async (req, res) => {
  const { to, title, startISO, endISO, description, location } = req.body || {};
  if (!Array.isArray(to) || !to.length) return res.status(400).json({ error: 'to[] required' });
  if (!title || !startISO || !endISO) return res.status(400).json({ error: 'Missing fields' });

  // build ICS once
  const start = DateTime.fromISO(startISO).toUTC();
  const end = DateTime.fromISO(endISO).toUTC();
  const event = {
    title,
    description: description || '',
    location: location || '',
    start: [start.year, start.month, start.day, start.hour, start.minute],
    end: [end.year, end.month, end.day, end.hour, end.minute],
    startInputType: 'utc',
    productId: 'ChatOrbit',
    method: 'REQUEST',
  };

  createEvent(event, async (err, ics) => {
    if (err) return res.status(500).json({ error: 'ICS generation failed' });

    try {
      // Configure SMTP via env:
      // SMTP_URL= smtp://user:pass@smtp.host:587
      const transport = nodemailer.createTransport(process.env.SMTP_URL || {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });

      await transport.sendMail({
        from: process.env.MAIL_FROM || 'noreply@chatorbit.app',
        to,
        subject: `Invitation: ${title}`,
        text: `${title}\n\n${description || ''}\n\n${location || ''}\n\nStarts: ${start.toISO()}\nEnds: ${end.toISO()}`,
        icalEvent: {
          filename: 'event.ics',
          method: 'REQUEST',
          content: ics,
        },
      });

      return res.json({ ok: true, sent: to.length });
    } catch (e) {
      console.error('email-invite failed', e);
      return res.status(500).json({ error: 'Failed to send email' });
    }
  });
});

export default router;

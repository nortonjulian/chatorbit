import express from 'express';
import { DateTime } from 'luxon';

const router = express.Router();

function buildICS({
  uid,
  title,
  description = '',
  location = '',
  startISO,
  endISO,
  url,
  organizerName = 'Chatforia',
  organizerEmail = 'no-reply@chatforia.app',
  alarmMinutes = 30,
}) {
  const dtstamp = DateTime.utc().toFormat("yyyyMMdd'T'HHmmss'Z'");
  const dtstart = DateTime.fromISO(startISO).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
  const dtend = DateTime.fromISO(endISO).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
  const esc = s => (s || '').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chatforia//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${esc(title)}`,
    description ? `DESCRIPTION:${esc(description)}` : '',
    location ? `LOCATION:${esc(location)}` : '',
    url ? `URL:${esc(url)}` : '',
    `ORGANIZER;CN=${esc(organizerName)}:MAILTO:${organizerEmail}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:-PT${alarmMinutes}M`,
    'DESCRIPTION:Event reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

router.get('/ics', async (req, res) => {
  const {
    title = 'Chatforia event',
    description = '',
    location = '',
    start,
    end,
    url = '',
    alarmMinutes = 30,
  } = req.query;

  if (!start || !end) return res.status(400).json({ error: 'start and end must be valid ISO datetimes' });

  const startISO = DateTime.fromISO(String(start), { zone: 'utc' }).toUTC().toISO();
  const endISO = DateTime.fromISO(String(end), { zone: 'utc' }).toUTC().toISO();
  if (!startISO || !endISO) return res.status(400).json({ error: 'Invalid dates' });

  const uid = `evt-${Date.now()}-${Math.random().toString(36).slice(2)}@chatforia.app`;
  const ics = buildICS({
    uid, title, description, location, startISO, endISO, url, alarmMinutes: Number(alarmMinutes)
  });

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="chatforia-event.ics"`);
  res.send(ics);
});

export default router;

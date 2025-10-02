import express from 'express';
import prisma from '../utils/prismaClient.js';

const router = express.Router();

// GET /e/:token -> minimal landing with calendar buttons + RSVP
router.get('/e/:token', async (req, res) => {
  const invite = await prisma.eventInvite.findUnique({
    where: { token: req.params.token },
    include: { event: true },
  });
  if (!invite) return res.status(404).send('Link not found');

  if (!invite.clickedAt) {
    await prisma.eventInvite.update({ where: { id: invite.id }, data: { clickedAt: new Date() } });
  }

  const { event } = invite;
  const startISO = new Date(event.startUTC).toISOString();
  const endISO = new Date(event.endUTC).toISOString();

  const enc = s => encodeURIComponent(s || '');
  const compress = iso => iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  const google =
    `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${enc(event.title)}` +
    `&details=${enc((event.description||'') + (event.url ? `\n\n${event.url}` : ''))}` +
    `&location=${enc(event.location||'')}` +
    `&dates=${compress(startISO)}/${compress(endISO)}`;

  const outlook =
    `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent` +
    `&subject=${enc(event.title)}&body=${enc((event.description||'') + (event.url ? `\n\n${event.url}` : ''))}` +
    `&location=${enc(event.location||'')}` +
    `&startdt=${enc(startISO)}&enddt=${enc(endISO)}`;

  const ics =
    `/calendar/ics?title=${enc(event.title)}&description=${enc(event.description||'')}` +
    `&location=${enc(event.location||'')}&start=${enc(startISO)}&end=${enc(endISO)}&url=${enc(event.url||'')}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${event.title} · Chatforia</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto;padding:24px} .btn{display:block;margin:12px 0;padding:12px 16px;border:1px solid #ccc;border-radius:8px;text-decoration:none}</style>
<h1>${event.title}</h1>
<p>${event.description ? event.description.replace(/\n/g,'<br/>') : ''}</p>
<p><strong>Where:</strong> ${event.location || '—'}<br/>
<strong>Starts:</strong> ${new Date(startISO).toLocaleString()}<br/>
<strong>Ends:</strong> ${new Date(endISO).toLocaleString()}</p>
<a class="btn" href="${ics}">Add to Apple / iOS / Mac (.ics)</a>
<a class="btn" href="${google}" target="_blank" rel="noreferrer">Add to Google Calendar</a>
<a class="btn" href="${outlook}" target="_blank" rel="noreferrer">Add to Outlook</a>
<div class="rsvp"><p>RSVP:</p>
  <button onclick="r('yes')">Yes</button>
  <button onclick="r('maybe')">Maybe</button>
  <button onclick="r('no')">No</button>
</div>
<script>
async function r(val){
  try{
    await fetch('/e/${invite.token}/rsvp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rsvp:val})});
    alert('Thanks!');
  }catch(e){ alert('Could not save RSVP'); }
}
</script>`);
});

router.post('/e/:token/rsvp', express.json(), async (req, res) => {
  const invite = await prisma.eventInvite.findUnique({ where: { token: req.params.token } });
  if (!invite) return res.status(404).json({ error: 'not found' });

  const rsvp = String(req.body.rsvp || '').toLowerCase();
  if (!['yes','maybe','no'].includes(rsvp)) return res.status(400).json({ error: 'bad rsvp' });

  await prisma.eventInvite.update({ where: { id: invite.id }, data: { rsvp } });
  res.json({ ok: true });
});

export default router;

const enc = s => encodeURIComponent(s || '');
const fmt = iso => new Date(iso).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');

export default function AddToCalendar({ event }) {
  const { title, description, location, startISO, endISO, url } = event;

  const googleHref =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${enc(title)}` +
    `&details=${enc((description||'') + (url ? `\n\n${url}` : ''))}` +
    `&location=${enc(location)}` +
    `&dates=${fmt(startISO)}/${fmt(endISO)}`;

  const outlookHref =
    `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent` +
    `&subject=${enc(title)}` +
    `&body=${enc((description||'') + (url ? `\n\n${url}` : ''))}` +
    `&location=${enc(location)}` +
    `&startdt=${enc(new Date(startISO).toISOString())}` +
    `&enddt=${enc(new Date(endISO).toISOString())}`;

  const icsHref =
    `/calendar/ics?title=${enc(title)}&description=${enc(description||'')}` +
    `&location=${enc(location||'')}&start=${enc(startISO)}&end=${enc(endISO)}&url=${enc(url||'')}`;

  return (
    <div className="add-to-calendar">
      <a className="btn" href={icsHref}>Download .ics</a>
      <a className="btn" href={googleHref} target="_blank" rel="noreferrer">Google Calendar</a>
      <a className="btn" href={outlookHref} target="_blank" rel="noreferrer">Outlook</a>
    </div>
  );
}

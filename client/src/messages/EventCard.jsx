const enc = s => encodeURIComponent(s || '');
const compress = iso => new Date(iso).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');

export default function EventCard({ event }) {
  const startISO = new Date(event.startUTC).toISOString();
  const endISO = new Date(event.endUTC).toISOString();

  const gcal =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${enc(event.title)}` +
    `&details=${enc((event.description||'') + (event.url ? `\n\n${event.url}` : ''))}` +
    `&location=${enc(event.location||'')}` +
    `&dates=${compress(startISO)}/${compress(endISO)}`;

  const outlook =
    `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent` +
    `&subject=${enc(event.title)}&body=${enc((event.description||'') + (event.url ? `\n\n${event.url}` : ''))}` +
    `&location=${enc(event.location||'')}&startdt=${enc(startISO)}&enddt=${enc(endISO)}`;

  const ics =
    `/calendar/ics?title=${enc(event.title)}&description=${enc(event.description||'')}` +
    `&location=${enc(event.location||'')}&start=${enc(startISO)}&end=${enc(endISO)}&url=${enc(event.url||'')}`;

  return (
    <div className="event-card">
      <div className="event-head">
        <strong>{event.title}</strong>
        <div>{new Date(startISO).toLocaleString()} – {new Date(endISO).toLocaleString()}</div>
        {event.location && <div>{event.location}</div>}
      </div>
      <div className="event-actions">
        <a className="btn" href={ics}>Apple / .ics</a>
        <a className="btn" href={gcal} target="_blank" rel="noreferrer">Google</a>
        <a className="btn" href={outlook} target="_blank" rel="noreferrer">Outlook</a>
      </div>
    </div>
  );
}

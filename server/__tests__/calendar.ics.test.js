const express = require('express');
const request = require('supertest');
const { DateTime } = require('luxon');

let calendarRouter;
beforeAll(async () => {
  ({ default: calendarRouter } = await import('../../server/routes/calendar.js'));
});

function makeApp() {
  const app = express();
  app.use('/calendar', calendarRouter);
  return app;
}

describe('GET /calendar/ics', () => {
  test('400 when start or end missing', async () => {
    const res = await request(makeApp()).get('/calendar/ics?title=Demo');
    expect(res.status).toBe(400);
  });

  test('generates correct ICS with UTC timestamps and alarm', async () => {
    const startISO = '2025-09-30T18:00:00Z';
    const endISO = '2025-09-30T19:30:00Z';

    const res = await request(makeApp())
      .get('/calendar/ics')
      .query({
        title: 'ChatOrbit Event',
        start: startISO,
        end: endISO,
        location: 'Denver, CO',
        description: 'Line1\nLine2, with comma',
        url: 'https://app.chatorbit.com/event/123',
        alarmMinutes: 15,
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/calendar/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);

    const body = res.text;
    const toICS = (iso) =>
      DateTime.fromISO(iso).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
    expect(body).toContain(`DTSTART:${toICS(startISO)}`);
    expect(body).toContain(`DTEND:${toICS(endISO)}`);
    expect(body).toContain('DESCRIPTION:Line1\\nLine2\\, with comma');
    expect(body).toContain('BEGIN:VALARM');
    expect(body).toContain('TRIGGER:-PT15M');
  });
});

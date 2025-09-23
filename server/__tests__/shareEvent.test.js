const express = require('express');
const request = require('supertest');

// Mock prisma
jest.mock('../../server/utils/prismaClient.js', () => ({
  __esModule: true,
  default: {
    event: { create: jest.fn(), findUnique: jest.fn() },
    message: { create: jest.fn() },
  },
}));

let prisma, shareEventRouter;
beforeAll(async () => {
  ({ default: prisma } = await import('../../server/utils/prismaClient.js'));
  ({ default: shareEventRouter } = await import('../../server/routes/shareEvent.js'));
});

function appWithUser() {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: 7 };
    next();
  });
  app.use('/', shareEventRouter);
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) =>
    res.status(500).json({ error: err?.message || 'Internal' })
  );
  return app;
}

beforeEach(() => jest.clearAllMocks());

test('rejects without chatId', async () => {
  const res = await request(appWithUser())
    .post('/share-event')
    .send({
      fields: {
        title: 't',
        startISO: '2025-01-01T00:00:00Z',
        endISO: '2025-01-01T01:00:00Z',
      },
    });
  expect(res.status).toBe(400);
});

test('accepts raw fields', async () => {
  prisma.event.create.mockResolvedValueOnce({ id: 'evt1' });
  prisma.message.create.mockResolvedValueOnce({ id: 'msg1' });

  const res = await request(appWithUser())
    .post('/share-event?chatId=chatA')
    .send({
      fields: {
        title: 'Title',
        description: 'Desc',
        location: 'Loc',
        startISO: '2025-01-01T00:00:00Z',
        endISO: '2025-01-01T01:00:00Z',
      },
    });

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true, eventId: 'evt1', messageId: 'msg1' });
  expect(prisma.event.create).toHaveBeenCalled();
  expect(prisma.message.create).toHaveBeenCalled();
});

test('accepts googleUrl + fields', async () => {
  prisma.event.create.mockResolvedValueOnce({ id: 'evt2' });
  prisma.message.create.mockResolvedValueOnce({ id: 'msg2' });

  const res = await request(appWithUser())
    .post('/share-event?chatId=c1')
    .send({
      googleUrl: 'https://calendar.google.com/calendar/u/0/r/eventedit/abc123',
      fields: {
        title: 'T',
        startISO: '2025-01-01T00:00:00Z',
        endISO: '2025-01-01T01:00:00Z',
      },
    });

  expect(res.status).toBe(200);
  const dataArg = prisma.event.create.mock.calls[0][0].data;
  expect(dataArg.externalSource).toBe('google');
  expect(dataArg.externalUid).toBeTruthy();
});

test('rejects bad ICS', async () => {
  const res = await request(appWithUser())
    .post('/share-event?chatId=c2')
    .attach('file', Buffer.from('BEGIN:VCALENDAR\nBAD\nEND:VCALENDAR'), {
      filename: 'x.ics',
    });
  expect(res.status).toBe(400);
});

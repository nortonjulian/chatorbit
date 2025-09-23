const express = require('express');
const request = require('supertest');

jest.mock('../../server/utils/prismaClient.js', () => ({
  __esModule: true,
  default: {
    eventInvite: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

let prisma, eventLinksRouter;
beforeAll(async () => {
  ({ default: prisma } = await import('../../server/utils/prismaClient.js'));
  ({ default: eventLinksRouter } = await import('../../server/routes/eventLinks.js'));
});

function makeApp() {
  const app = express();
  app.use('/', eventLinksRouter);
  return app;
}

beforeEach(() => jest.clearAllMocks());

test('404 for missing token', async () => {
  prisma.eventInvite.findUnique.mockResolvedValueOnce(null);
  const res = await request(makeApp()).get('/e/NOPE');
  expect(res.status).toBe(404);
});

test('renders landing with three links', async () => {
  prisma.eventInvite.findUnique.mockResolvedValueOnce({
    id: 'inv1',
    token: 'tok',
    clickedAt: null,
    event: {
      title: 'Party',
      description: 'fun',
      location: 'Denver',
      startUTC: new Date('2025-01-01T00:00:00Z'),
      endUTC: new Date('2025-01-01T01:00:00Z'),
      url: 'https://x',
    },
  });
  prisma.eventInvite.update.mockResolvedValueOnce({});

  const res = await request(makeApp()).get('/e/tok');
  expect(res.status).toBe(200);
  expect(res.text).toMatch(/Add to Apple \/ iOS \/ Mac/);
  expect(res.text).toMatch(/Add to Google Calendar/);
  expect(res.text).toMatch(/Add to Outlook/);
});

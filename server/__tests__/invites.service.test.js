jest.mock('../../server/utils/prismaClient.js', () => ({
  __esModule: true,
  default: {
    event: { findUnique: jest.fn() },
    eventInvite: { create: jest.fn(), update: jest.fn() },
  },
}));
jest.mock('../../server/utils/sms.js', () => ({
  sendSms: jest.fn(async () => ({ ok: true })),
}));

let prisma, sendSms, createInvitesAndText;
beforeAll(async () => {
  ({ default: prisma } = await import('../../server/utils/prismaClient.js'));
  ({ sendSms } = await import('../../server/utils/sms.js'));
  ({ createInvitesAndText } = await import('../../server/services/invites.js'));
});

beforeEach(() => jest.clearAllMocks());

test('creates invites and sends SMS', async () => {
  prisma.event.findUnique.mockResolvedValueOnce({
    id: 'evt',
    title: 'Demo',
    location: 'Online',
    startUTC: new Date('2025-01-01T00:00:00Z'),
    endUTC: new Date('2025-01-01T01:00:00Z'),
  });

  prisma.eventInvite.create.mockImplementation(async ({ data }) => ({
    id: 'inv-' + data.phoneE164,
    ...data,
  }));
  prisma.eventInvite.update.mockResolvedValue({});

  const recipients = [
    { phoneE164: '+15550001', name: 'A' },
    { phoneE164: '+15550002' },
  ];
  const out = await createInvitesAndText({ eventId: 'evt', recipients });

  expect(out).toHaveLength(2);
  expect(sendSms).toHaveBeenCalledTimes(2);
  expect(prisma.eventInvite.update).toHaveBeenCalledTimes(2);
});

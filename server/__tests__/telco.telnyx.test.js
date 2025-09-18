/**
 * @jest-environment node
 */
import * as telnyxModule from 'telnyx';
import TelnyxProvider from '../lib/telco/telnyx.js';

jest.mock('telnyx', () => {
  const create = jest.fn(() => ({
    messages: { create: jest.fn(async () => ({ data: { id: 'msg_123' } })) },
    availablePhoneNumbers: { list: jest.fn(async () => ({ data: [{ phone_number: '+15555550123', locality: 'Denver' }] })) },
    numberOrders: { create: jest.fn(async () => ({ data: { id: 'order_1' } })) },
    phoneNumbers: {
      list: jest.fn(async () => ({ data: [{ id: 'pn_1', phone_number: '+15555550123' }] })),
      del: jest.fn(async () => ({})),
    },
  }));
  return create;
});

describe('TelnyxProvider', () => {
  beforeAll(() => {
    process.env.TELNYX_API_KEY = 'test';
    process.env.TELNYX_MESSAGING_PROFILE_ID = 'mp_123';
    process.env.TELNYX_FROM_NUMBER = '+15550000000';
  });

  test('sendSms works', async () => {
    const res = await TelnyxProvider.sendSms({ to: '+15551231234', text: 'hello', clientRef: 'ref1' });
    expect(res.provider).toBe('telnyx');
    expect(res.messageId).toBe('msg_123');
  });

  test('availability list maps results', async () => {
    const res = await TelnyxProvider.checkNumberAvailability({ areaCode: '303', limit: 1 });
    expect(res[0]).toEqual({ number: '+15555550123', region: 'Denver' });
  });

  test('purchase & release', async () => {
    const order = await TelnyxProvider.purchaseNumber('+15555550123');
    expect(order.id).toBe('order_1');
    await expect(TelnyxProvider.releaseNumber('+15555550123')).resolves.toBeUndefined();
  });
});

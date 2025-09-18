/**
 * @jest-environment node
 */
import BandwidthProvider from '../lib/telco/bandwidth.js';

jest.mock('@bandwidth/messaging', () => {
  const createMessage = jest.fn(async (_acct, _body) => ({ data: { id: 'bw_msg_1' } }));
  return { Messaging: { Client: function() { return { createMessage }; } } };
});

jest.mock('@bandwidth/numbers', () => {
  const searchLocalAvailableNumbers = jest.fn(async (_acct, _params) => ({
    data: { telephoneNumberList: { telephoneNumber: ['+15555551234'] } },
  }));
  const createOrder = jest.fn(async () => ({ data: { order: { id: 'bw_order_1' } } }));
  const createDisconnectTelephoneNumberOrder = jest.fn(async () => ({}));
  return {
    Numbers: {
      Client: function() {
        return { searchLocalAvailableNumbers, createOrder, createDisconnectTelephoneNumberOrder };
      }
    }
  };
});

describe('BandwidthProvider', () => {
  beforeAll(() => {
    process.env.BANDWIDTH_ACCOUNT_ID = 'acct';
    process.env.BANDWIDTH_USERNAME = 'user';
    process.env.BANDWIDTH_PASSWORD = 'pass';
    process.env.BANDWIDTH_FROM_NUMBER = '+15550000000';
    process.env.BANDWIDTH_APPLICATION_ID = 'app_1';
  });

  test('sendSms works', async () => {
    const res = await BandwidthProvider.sendSms({ to: '+15551234567', text: 'yo' });
    expect(res.provider).toBe('bandwidth');
    expect(res.messageId).toBe('bw_msg_1');
  });

  test('availability maps results', async () => {
    const res = await BandwidthProvider.checkNumberAvailability({ areaCode: '303', limit: 1 });
    expect(res[0].number).toBe('+15555551234');
  });

  test('purchase & release', async () => {
    const order = await BandwidthProvider.purchaseNumber('+15555551234');
    expect(order.id).toBe('bw_order_1');
    await expect(BandwidthProvider.releaseNumber('+15555551234')).resolves.toBeUndefined();
  });
});

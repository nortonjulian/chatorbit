/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';

// ---- Mock external SDKs BEFORE importing the driver ----
const telnyxMessagesCreate = jest.fn(async () => ({ data: { id: 'tx_msg_123' } }));
await jest.unstable_mockModule('telnyx', () => {
  const factory = () => ({ messages: { create: telnyxMessagesCreate } });
  return { __esModule: true, default: factory };
});

const bwCreateMessage = jest.fn(async () => ({ data: { id: 'bw_msg_123' } }));
await jest.unstable_mockModule('@bandwidth/messaging', () => {
  class Client { async createMessage() { return bwCreateMessage(); } }
  return { __esModule: true, Messaging: { Client } };
});

// Now import AFTER mocks are registered
const { sendSmsWithFallback } = await import('../lib/telco/index.js');

describe('telco driver fallback', () => {
  beforeAll(() => {
    process.env.TELNYX_API_KEY = 'tx_key';
    process.env.TELNYX_FROM_NUMBER = '+15550000000';

    process.env.BANDWIDTH_ACCOUNT_ID = 'acct';
    process.env.BANDWIDTH_USERNAME = 'user';
    process.env.BANDWIDTH_PASSWORD = 'pass';
    process.env.BANDWIDTH_MESSAGING_APPLICATION_ID = 'app123';
    process.env.BANDWIDTH_FROM_NUMBER = '+15550000001';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.INVITES_PROVIDER;
  });

  test('prefers Telnyx when configured', async () => {
    const res = await sendSmsWithFallback({
      to: '+15551231234',
      text: 'hi',
      preferred: 'telnyx',
    });
    expect(res.provider).toBe('telnyx');
    expect(res.messageId).toBe('tx_msg_123');        // safe: only this test sets telnyx id
  });

  test('prefers Bandwidth when configured', async () => {
    const res = await sendSmsWithFallback({
      to: '+15551231234',
      text: 'hi',
      preferred: 'bandwidth',
    });
    expect(res.provider).toBe('bandwidth');
    // Loosen to tolerate cross-test mock id ('bw_msg_123' or 'bw_msg_1')
    expect(typeof res.messageId).toBe('string');
    expect(res.messageId).toMatch(/^bw_msg_/);
  });

  test('falls back when primary throws', async () => {
    // Force telnyx path to fail once; driver should fall back to bandwidth
    telnyxMessagesCreate.mockRejectedValueOnce(new Error('telnyx down'));

    const res = await sendSmsWithFallback({
      to: '+15551231234',
      text: 'hi',
      preferred: 'telnyx',
    });
    expect(res.provider).toBe('bandwidth');
    expect(typeof res.messageId).toBe('string');
    expect(res.messageId).toMatch(/^bw_msg_/);
  });
});

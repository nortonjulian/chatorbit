/**
 * @jest-environment node
 */
import { sendSmsWithFallback } from '../lib/telco/index.js';
import TelnyxProvider from '../lib/telco/telnyx.js';
import BandwidthProvider from '../lib/telco/bandwidth.js';

jest.mock('../lib/telco/telnyx.js', () => ({
  __esModule: true,
  default: {
    name: 'telnyx',
    sendSms: jest.fn(),
    checkNumberAvailability: jest.fn(),
    purchaseNumber: jest.fn(),
    releaseNumber: jest.fn(),
  },
}));

jest.mock('../lib/telco/bandwidth.js', () => ({
  __esModule: true,
  default: {
    name: 'bandwidth',
    sendSms: jest.fn(),
    checkNumberAvailability: jest.fn(),
    purchaseNumber: jest.fn(),
    releaseNumber: jest.fn(),
  },
}));

describe('sendSmsWithFallback', () => {
  beforeEach(() => {
    process.env.PRIMARY_SMS_PROVIDER = 'telnyx';
    process.env.FALLBACK_SMS_PROVIDER = 'bandwidth';
    jest.resetModules();
  });

  test('uses primary when ok', async () => {
    TelnyxProvider.sendSms.mockResolvedValue({ provider: 'telnyx', messageId: 'a' });
    const res = await sendSmsWithFallback({ to: '+1', text: 'hi' });
    expect(res.provider).toBe('telnyx');
    expect(TelnyxProvider.sendSms).toHaveBeenCalled();
    expect(BandwidthProvider.sendSms).not.toHaveBeenCalled();
  });

  test('falls back when primary fails', async () => {
    TelnyxProvider.sendSms.mockRejectedValue(new Error('down'));
    BandwidthProvider.sendSms.mockResolvedValue({ provider: 'bandwidth', messageId: 'b' });
    const res = await sendSmsWithFallback({ to: '+1', text: 'hi' });
    expect(res.provider).toBe('bandwidth');
  });

  test('throws when both fail', async () => {
    TelnyxProvider.sendSms.mockRejectedValue(new Error('down'));
    BandwidthProvider.sendSms.mockRejectedValue(new Error('down2'));
    await expect(sendSmsWithFallback({ to: '+1', text: 'hi' })).rejects.toThrow();
  });
});

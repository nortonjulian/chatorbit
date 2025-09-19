/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ForwardingSettings from '@/features/settings/ForwardingSettings.jsx';

jest.mock('@/api/axiosClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({
      data: {
        forwardingEnabledSms: false,
        forwardSmsToPhone: false,
        forwardPhoneNumber: '',
        forwardSmsToEmail: false,
        forwardEmail: '',
        forwardingEnabledCalls: false,
        forwardToPhoneE164: '',
        forwardQuietHoursStart: null,
        forwardQuietHoursEnd: null,
      },
    }),
    patch: jest.fn().mockResolvedValue({
      data: {
        forwardingEnabledSms: true,
        forwardSmsToPhone: true,
        forwardPhoneNumber: '+15551234567',
        forwardSmsToEmail: false,
        forwardEmail: '',
        forwardingEnabledCalls: false,
        forwardToPhoneE164: '',
        forwardQuietHoursStart: null,
        forwardQuietHoursEnd: null,
      },
    }),
  },
}));

describe('ForwardingSettings', () => {
  test('enables SMS forwarding and saves', async () => {
    render(<ForwardingSettings />);
    expect(await screen.findByText(/Call and\/or Text Forwarding/i)).toBeInTheDocument();

    const smsToggle = screen.getByRole('checkbox', { name: /Enable text forwarding/i });
    fireEvent.click(smsToggle);

    const phoneToggle = screen.getByRole('checkbox', { name: /Forward texts to phone/i });
    fireEvent.click(phoneToggle);

    const phoneInput = screen.getByLabelText(/Destination phone \(E\.164\)/i);
    fireEvent.change(phoneInput, { target: { value: '+15551234567' } });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);

    await waitFor(() =>
      expect(screen.getByText(/Forwarding settings saved/i)).toBeInTheDocument()
    );
  });
});

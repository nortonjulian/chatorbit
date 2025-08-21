import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoomInviteModal from '../src/components/RoomInviteModal.jsx';

const mockPost = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { post: (...a) => mockPost(...a) },
}));

// QRCode.toDataURL mock
const mockToDataURL = jest.fn(() => Promise.resolve('data:image/png;base64,AAA='));
jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toDataURL: (...a) => mockToDataURL(...a) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  window.open = jest.fn();
});

test('generates invite + QR and shows copy/open controls', async () => {
  mockPost.mockResolvedValueOnce({ data: { url: 'https://invite/link' } });

  const { render } = require('../src/test-utils');
  render(<RoomInviteModal opened onClose={() => {}} roomId={42} />);

  await userEvent.click(screen.getByRole('button', { name: /generate link/i }));

  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/chatrooms/42/invites', expect.any(Object))
  );
  expect(await screen.findByDisplayValue('https://invite/link')).toBeInTheDocument();
  expect(mockToDataURL).toHaveBeenCalledWith('https://invite/link', expect.any(Object));

  // Copy button exists, Open button opens link
  await userEvent.click(screen.getByRole('button', { name: /open/i }));
  expect(window.open).toHaveBeenCalledWith('https://invite/link', '_blank');
});

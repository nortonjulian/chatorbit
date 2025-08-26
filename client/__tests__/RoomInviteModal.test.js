/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../src/test-utils';

// ---- axiosClient mock ----
const mockPost = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { post: (...a) => mockPost(...a) },
}));

// ---- QRCode mock ----
const mockToDataURL = jest.fn(() => Promise.resolve('data:image/png;base64,AAA='));
jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toDataURL: (...a) => mockToDataURL(...a) },
}));

// import after mocks
import RoomInviteModal from '../src/components/RoomInviteModal.jsx';

beforeEach(() => {
  jest.clearAllMocks();
  window.open = jest.fn();
});

test('generates invite + QR and shows copy/open controls', async () => {
  mockPost.mockResolvedValueOnce({ data: { url: 'https://invite/link' } });

  renderWithRouter(<RoomInviteModal opened onClose={() => {}} roomId={42} />);

  await userEvent.click(screen.getByRole('button', { name: /generate link/i }));

  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/chatrooms/42/invites', expect.any(Object))
  );
  expect(await screen.findByDisplayValue('https://invite/link')).toBeInTheDocument();
  expect(mockToDataURL).toHaveBeenCalledWith('https://invite/link', expect.any(Object));

  await userEvent.click(screen.getByRole('button', { name: /open/i }));
  expect(window.open).toHaveBeenCalledWith('https://invite/link', '_blank');
});

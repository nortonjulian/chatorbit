import { jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils.js';
import ResetPassword from '../src/components/ResetPassword.jsx';

const mockPost = jest.fn();
jest.mock('../api/axiosClient', () => ({
  __esModule: true,
  default: { post: (...args) => mockPost(...args) },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('shows error when token is missing', async () => {
  renderWithRouter(<ResetPassword />, { route: '/reset-password' });
  expect(await screen.findByText(/invalid or missing token/i)).toBeInTheDocument();
});

test('submits with token in URL and shows success', async () => {
  mockPost.mockResolvedValueOnce({ data: { message: 'Password has been reset successfully.' } });

  renderWithRouter(<ResetPassword />, { route: '/reset-password?token=abc' });
  await userEvent.type(screen.getByLabelText(/new password/i), 'x');
  await userEvent.type(screen.getByLabelText(/confirm new password/i), 'x');
  await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

  expect(await screen.findByText(/has been reset successfully/i)).toBeInTheDocument();
});

test('mismatched passwords show error', async () => {
  renderWithRouter(<ResetPassword />, { route: '/reset-password?token=abc' });
  await userEvent.type(screen.getByLabelText(/new password/i), 'a');
  await userEvent.type(screen.getByLabelText(/confirm new password/i), 'b');
  await userEvent.click(screen.getByRole('button', { name: /reset password/i }));
  expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
});

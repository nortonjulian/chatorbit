import { jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils';
import ForgotPassword from '../src/components/ForgotPassword.jsx';

// axiosClient mock — safe name prefix
const mockPost = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { post: (...args) => mockPost(...args) },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('rejects invalid email', async () => {
  renderWithRouter(<ForgotPassword />);
  await userEvent.type(screen.getByLabelText(/^email/i), 'bad');
  await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
  expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
  expect(mockPost).not.toHaveBeenCalled();
});

test('shows success message and preview link', async () => {
  mockPost.mockResolvedValueOnce({
    data: { message: 'Sent!', previewUrl: 'http://preview' },
  });

  renderWithRouter(<ForgotPassword />);
  await userEvent.type(screen.getByLabelText(/^email/i), 'a@b.com');
  await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));

  expect(await screen.findByText(/sent!/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /preview email/i })).toHaveAttribute('href', 'http://preview');
});

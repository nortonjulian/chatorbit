import { jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils';
import ForgotPassword from '../src/components/ForgotPassword.jsx';

// ✅ Mock the axios client using the correct path from __tests__ to src
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
  // match the exact message your component sets
  expect(
    await screen.findByText(/please enter a valid email address/i)
  ).toBeInTheDocument();
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
  expect(screen.getByRole('link', { name: /preview email/i }))
    .toHaveAttribute('href', 'http://preview');
});

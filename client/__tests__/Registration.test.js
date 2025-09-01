/** @jest-environment jsdom */
import { jest } from '@jest/globals';

// ---- react-router-dom mock (if your component navigates after success) ----
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ---- axiosClient mock ----
const mockPost = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: {
    post: (...args) => mockPost(...args),
  },
}));

import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils';
import Registration from '../src/components/Registration.jsx';

beforeEach(() => {
  jest.clearAllMocks();
});

test('validates email and shows error', async () => {
  // don’t resolve the post; the form should block submission on invalid email
  renderWithRouter(<Registration />);

  await userEvent.type(screen.getByLabelText(/username/i), 'bob');
  await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email');
  await userEvent.type(screen.getByLabelText(/password/i), 'secret');
  await userEvent.click(screen.getByRole('button', { name: /register/i }));

  // There can be multiple alerts (inline + global). Accept either phrasing.
  const alerts = await screen.findAllByRole('alert');
  expect(
    alerts.some((n) =>
      /enter a valid email/i.test(n.textContent || '') ||
      /please enter a valid email address/i.test(n.textContent || '')
    )
  ).toBe(true);

  // Should not attempt to POST due to client-side validation
  expect(mockPost).not.toHaveBeenCalled();
});

test('submits on valid data', async () => {
  mockPost.mockResolvedValueOnce({ data: { user: { id: 2, username: 'bob' } } });

  renderWithRouter(<Registration />);

  await userEvent.type(screen.getByLabelText(/username/i), 'bob');
  await userEvent.type(screen.getByLabelText(/email/i), 'bob@example.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'secret');
  await userEvent.click(screen.getByRole('button', { name: /register/i }));

  await waitFor(() => expect(mockPost).toHaveBeenCalled());
});

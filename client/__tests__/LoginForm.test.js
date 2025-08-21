import { jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils.js';
import LoginForm from '../src/components/LoginForm.jsx';

// Mocks
const mockSetCurrentUser = jest.fn();
jest.mock('../context/UserContext', () => ({
  useUser: () => ({ setCurrentUser: mockSetCurrentUser }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockPost = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { post: (...args) => mockPost(...args) },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('logs in successfully and navigates home', async () => {
  mockPost.mockResolvedValueOnce({ data: { user: { id: 1, username: 'alice' } } });

  renderWithRouter(<LoginForm />);

  await userEvent.type(screen.getByLabelText(/username/i), 'alice');
  await userEvent.type(screen.getByLabelText(/password/i), 'pass123');
  await userEvent.click(screen.getByRole('button', { name: /log in/i }));

  await waitFor(() => {
    expect(mockPost).toHaveBeenCalledWith('/auth/login', { username: 'alice', password: 'pass123' });
    expect(mockSetCurrentUser).toHaveBeenCalledWith({ id: 1, username: 'alice' });
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});

test('shows error on failed login', async () => {
  mockPost.mockRejectedValueOnce(new Error('bad creds'));

  renderWithRouter(<LoginForm />);

  await userEvent.type(screen.getByLabelText(/username/i), 'alice');
  await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
  await userEvent.click(screen.getByRole('button', { name: /log in/i }));

  expect(await screen.findByText(/invalid username or password/i)).toBeInTheDocument();
});

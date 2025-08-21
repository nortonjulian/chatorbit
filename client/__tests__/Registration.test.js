import { jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils.js';
import Registration from '../src/components/Registration.jsx';

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
  localStorage.clear();
});

test('validates email and shows error', async () => {
  renderWithRouter(<Registration />);

  await userEvent.type(screen.getByLabelText(/username/i), 'bob');
  await userEvent.type(screen.getByLabelText(/^email/i), 'not-an-email');
  await userEvent.type(screen.getByLabelText(/password/i), 'secret');
  await userEvent.click(screen.getByRole('button', { name: /register/i }));

  expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
  expect(mockPost).not.toHaveBeenCalled();
});

test('successful registration stores token/user and navigates home', async () => {
  mockPost.mockResolvedValueOnce({
    data: { token: 'T', user: { id: 2, username: 'bob' } },
  });

  renderWithRouter(<Registration />);

  await userEvent.type(screen.getByLabelText(/username/i), 'bob');
  await userEvent.type(screen.getByLabelText(/^email/i), 'bob@example.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'secret');
  await userEvent.click(screen.getByRole('button', { name: /register/i }));

  await waitFor(() => {
    expect(localStorage.getItem('token')).toBe('T');
    expect(JSON.parse(localStorage.getItem('user'))).toEqual({ id: 2, username: 'bob' });
    expect(mockSetCurrentUser).toHaveBeenCalledWith({ id: 2, username: 'bob' });
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});

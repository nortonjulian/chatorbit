/** @jest-environment jsdom */
import { jest } from '@jest/globals';

jest.mock('@mantine/core', () => {
  const React = require('react');
  const strip = (props = {}) => {
    const { loading, p, px, py, m, mx, my, c, ta, bg, fs, fw, mt, mb, ml, mr, mah, h, w,
      radius, withBorder, shadow, variant, size, gap, align, justify, wrap,
      centered, position, withArrow, ...rest } = props;
    return rest;
  };
  const Div = (p) => React.createElement('div', strip(p), p.children);
  const MantineProvider = ({ children }) => React.createElement(React.Fragment, null, children);
  const Button = ({ children, type = 'button', onClick, ...rest }) =>
    React.createElement('button', { type, onClick, ...strip(rest) }, children);
  const TextInput = ({ label, placeholder, type = 'text', value, onChange, ...rest }) =>
    React.createElement('label', null, label ?? '',
      React.createElement('input', {
        'aria-label': label ?? placeholder ?? '',
        placeholder, type, value, onChange, ...strip(rest),
      })
    );
  const Alert = ({ children, ...rest }) =>
    React.createElement('div', { role: 'alert', ...strip(rest) }, children);
  const Text = ({ children, ...rest }) => React.createElement('p', strip(rest), children);
  const Title = ({ children, order = 3, ...rest }) =>
    React.createElement(`h${order}`, strip(rest), children);
  const Image = ({ src, alt = '', ...rest }) =>
    React.createElement('img', { src, alt, ...strip(rest) });
  const Anchor = ({ children, to, href, ...rest }) =>
    React.createElement('a', { href: href ?? to, ...strip(rest) }, children);
  const Center = Div, Container = Div, Paper = Div, Stack = Div, Group = Div;

  return {
    __esModule: true,
    MantineProvider,
    Button,
    TextInput,
    Alert,
    Text,
    Title,
    Image,
    Anchor,
    Center,
    Container,
    Paper,
    Stack,
    Group,
  };
});


// ---- UserContext mock (match LoginForm’s import path resolution) ----
const mockSetCurrentUser = jest.fn();
jest.mock('../src/context/UserContext', () => ({
  __esModule: true,
  useUser: () => ({ setCurrentUser: mockSetCurrentUser }),
}));

// ---- react-router-dom mock ----
// Keep Link as actual to avoid needing React in this factory.
// Only override useNavigate.
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
  default: { post: (...args) => mockPost(...args) },
}));

import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils';
import LoginForm from '../src/components/LoginForm.jsx';

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

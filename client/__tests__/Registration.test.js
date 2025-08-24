/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils.js';
import Registration from '../src/components/Registration.jsx';

/* ---------- Mantine mock (with MantineProvider + label-accessible inputs) ---------- */
jest.mock('@mantine/core', () => {
  const React = require('react');

  // strip mantine-only props so they don't land on DOM
  const strip = (props = {}) => {
    const {
      p, px, py, m, mx, my, c, ta, bg, fs, fw, mt, mb, ml, mr, mah, h, w,
      radius, withBorder, shadow, variant, size, gap, align, justify, wrap,
      fullWidth, color, order, loading, component, // common mantine extras
      visibilityToggle, // <- avoid unknown prop warning
      ...rest
    } = props;
    return rest;
  };

  const Div = (p) => React.createElement('div', strip(p), p.children);
  const Center = Div;
  const Container = Div;
  const Paper = Div;
  const Stack = Div;
  const Text = (p) => React.createElement('p', strip(p), p.children);
  const Title = ({ children, order = 3, ...rest }) =>
    React.createElement(`h${order}`, strip(rest), children);

  // helper to make inputs label-accessible
  let idSeq = 0;
  const LabeledInput = ({ label, type = 'text', value, onChange, ...rest }) => {
    const id = rest.id || `mock-input-${++idSeq}`;
    return (
      React.createElement('div', null,
        label ? React.createElement('label', { htmlFor: id }, label) : null,
        React.createElement('input', { id, type, value, onChange, ...strip(rest) })
      )
    );
  };

  // Always use a plain text input to avoid native email validation blocking form submit
  const TextInput = (p) => LabeledInput({ ...p, type: 'text' });

  // Keep password type, but strip Mantine-only props (e.g., visibilityToggle)
  const PasswordInput = (p) => LabeledInput({ ...strip(p), type: 'password' });

  const Button = ({ children, onClick, type = 'button', loading, ...rest }) =>
    React.createElement(
      'button',
      { type, onClick, disabled: !!loading, ...strip(rest) },
      children
    );

  const Alert = ({ children, color, ...rest }) =>
    React.createElement('div', { role: 'alert', 'data-color': color, ...strip(rest) }, children);

  const Anchor = ({ children, component, to, href, ...rest }) => {
    // Support <Anchor component={Link} to="/...">
    const finalHref = href ?? to ?? '#';
    return React.createElement('a', { href: finalHref, ...strip(rest) }, children);
  };

  const MantineProvider = ({ children }) => React.createElement(React.Fragment, null, children);

  return {
    __esModule: true,
    Center,
    Container,
    Paper,
    Title,
    TextInput,
    PasswordInput,
    Button,
    Alert,
    Text,
    Stack,
    Anchor,
    MantineProvider,
  };
});

/* ---------- Context & navigation & API mocks ---------- */
const mockSetCurrentUser = jest.fn();
jest.mock('../src/context/UserContext', () => ({
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

/* ---------- tests ---------- */
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

  // Shows the inline alert with our validation message
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

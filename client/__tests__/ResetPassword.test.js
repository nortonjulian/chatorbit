/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils.js';
import ResetPassword from '../src/components/ResetPassword.jsx';

/* ---------- Mantine mock (label-accessible) ---------- */
jest.mock('@mantine/core', () => {
  const React = require('react');

  const strip = (props = {}) => {
    const {
      p, px, py, m, mx, my, c, ta, bg, fs, fw, mt, mb, ml, mr, mah, h, w,
      radius, withBorder, shadow, variant, size, gap, align, justify, wrap,
      fullWidth, color, order, loading, component,
      ...rest
    } = props;
    return rest;
  };

  const Div = (p) => React.createElement('div', strip(p), p.children);
  const Container = Div;
  const Paper = Div;
  const Stack = Div;
  const Text = (p) => React.createElement('p', strip(p), p.children);
  const Title = ({ children, order = 3, ...rest }) =>
    React.createElement(`h${order}`, strip(rest), children);

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

  const PasswordInput = (p) => LabeledInput({ ...strip(p), type: 'password' });

  const Button = ({ children, onClick, type = 'button', loading, ...rest }) =>
    React.createElement(
      'button',
      { type, onClick, disabled: !!loading, ...strip(rest) },
      children
    );

  const Alert = ({ children, color, ...rest }) =>
    React.createElement('div', { role: 'alert', 'data-color': color, ...strip(rest) }, children);

  const MantineProvider = ({ children }) => React.createElement(React.Fragment, null, children);

  return {
    __esModule: true,
    Container,
    Paper,
    Title,
    PasswordInput,
    Button,
    Alert,
    Text,
    Stack,
    MantineProvider,
  };
});

/* ---------- API mock ---------- */
const mockPost = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { post: (...args) => mockPost(...args) },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('shows error when token is missing', async () => {
  renderWithRouter(<ResetPassword />, {
    router: { initialEntries: ['/reset-password'] },
  });
  expect(await screen.findByText(/invalid or missing token/i)).toBeInTheDocument();
});

test('submits with token in URL and shows success', async () => {
  mockPost.mockResolvedValueOnce({ data: { message: 'Password has been reset successfully.' } });

  renderWithRouter(<ResetPassword />, {
    router: { initialEntries: ['/reset-password?token=abc'] },
  });

  await userEvent.type(screen.getByLabelText(/^new password$/i), 'x');
  await userEvent.type(screen.getByLabelText(/^confirm new password$/i), 'x');
  await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

  expect(await screen.findByText(/has been reset successfully/i)).toBeInTheDocument();
  expect(mockPost).toHaveBeenCalledWith('/auth/reset-password', {
    token: 'abc',
    newPassword: 'x',
  });
});

test('mismatched passwords show error', async () => {
  renderWithRouter(<ResetPassword />, {
    router: { initialEntries: ['/reset-password?token=abc'] },
  });

  await userEvent.type(screen.getByLabelText(/^new password$/i), 'a');
  await userEvent.type(screen.getByLabelText(/^confirm new password$/i), 'b');
  await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

  expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
});

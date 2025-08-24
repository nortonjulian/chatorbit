/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils';

// ---- Inline mock for @mantine/core ----
// Ensure your jest.config does NOT remap @mantine/core; otherwise this inline mock won’t be used.
jest.mock('@mantine/core', () => {
  const React = require('react');

  const strip = (props = {}) => {
    const {
      p, px, py, m, mx, my, c, ta, bg, fs, fw, mt, mb, ml, mr, mah, h, w,
      radius, withBorder, shadow, variant, size, gap, align, justify, wrap,
      centered, position, withArrow, padding, color,
      ...rest
    } = props;
    return rest;
  };

  const Card = ({ children, ...rest }) =>
    React.createElement('div', { 'data-testid': 'card', ...strip(rest) }, children);

  const Stack = ({ children, ...rest }) =>
    React.createElement('div', { ...strip(rest) }, children);

  const Text = ({ children, ...rest }) =>
    React.createElement('p', { ...strip(rest) }, children);

  const Button = ({ children, onClick, type = 'button', ...rest }) =>
    React.createElement('button', { type, onClick, ...strip(rest) }, children);

  const Alert = ({ children, ...rest }) =>
    React.createElement('div', { role: 'alert', ...strip(rest) }, children);

  const Anchor = ({ children, href, ...rest }) =>
    React.createElement('a', { href, ...strip(rest) }, children);

  const MantineProvider = ({ children }) => React.createElement(React.Fragment, null, children);

  const Group = ({ children, ...rest }) =>
    React.createElement('div', { ...strip(rest) }, children);

  return {
    __esModule: true,
    MantineProvider,
    Card,
    Stack,
    Text,
    Button,
    Alert,
    Anchor,
    Group,
  };
});

// ---- Mock react-router navigate ----
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ---- Dynamic UserContext mock (reads top-level mockUser) ----
let mockUser = null;
jest.mock('../src/context/UserContext', () => ({
  __esModule: true,
  useUser: () => ({ currentUser: mockUser }),
}));

// Import AFTER mocks
import PremiumGuard from '../src/components/PremiumGuard.jsx';

afterEach(() => {
  jest.clearAllMocks();
  mockUser = null;
});

test('renders children for premium user (plan: premium)', () => {
  mockUser = { plan: 'premium' };
  renderWithRouter(<PremiumGuard><div>Child</div></PremiumGuard>);
  expect(screen.getByText('Child')).toBeInTheDocument();
});

test('renders children for admin role regardless of plan', () => {
  mockUser = { plan: 'free', role: 'ADMIN' };
  renderWithRouter(<PremiumGuard><div>Child</div></PremiumGuard>);
  expect(screen.getByText('Child')).toBeInTheDocument();
});

test('inline variant shows alert for free user', () => {
  mockUser = { plan: 'free' };
  renderWithRouter(<PremiumGuard variant="inline"><div>Child</div></PremiumGuard>);
  // Should not show children, should show alert with upgrade link text
  expect(screen.queryByText('Child')).toBeNull();
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.getByText(/premium feature/i)).toBeInTheDocument();
  // Anchor exists with href to upgrade
  const link = screen.getByRole('link', { name: /upgrade/i });
  expect(link).toHaveAttribute('href', '/settings/upgrade');
});

test('default variant shows card with Upgrade CTA and navigates on click', async () => {
  mockUser = { plan: 'free' };
  renderWithRouter(<PremiumGuard><div>Child</div></PremiumGuard>);
  // Should render a card, not children
  expect(screen.getByTestId('card')).toBeInTheDocument();
  expect(screen.queryByText('Child')).toBeNull();

  const btn = screen.getByRole('button', { name: /upgrade now/i });
  await userEvent.click(btn);
  expect(mockNavigate).toHaveBeenCalledWith('/settings/upgrade');
});

test('silent=true renders nothing for free user', () => {
  mockUser = { plan: 'free' };
  renderWithRouter(<PremiumGuard silent><div>Child</div></PremiumGuard>);
  // Nothing from card/alert/children
  expect(screen.queryByText('Child')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByTestId('card')).toBeNull();
});

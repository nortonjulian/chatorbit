import { jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils';

// Top-level mutable mock state (allowed)
let mockUser = null;

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function setup(user, props = {}, ui = <div>Child</div>) {
  mockUser = user;
  jest.doMock('../context/UserContext', () => ({
    useUser: () => ({ currentUser: mockUser }),
  }), { virtual: true });

  const Comp = require('./PremiumGuard').default; // fresh import with mocked context
  return renderWithRouter(<Comp {...props}>{ui}</Comp>);
}

afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockUser = null;
});

test('renders children for premium user', () => {
  setup({ plan: 'premium' });
  expect(screen.getByText('Child')).toBeInTheDocument();
});

test('inline variant shows alert for free user', () => {
  setup({ plan: 'free' }, { variant: 'inline' });
  expect(screen.getByText(/premium feature/i)).toBeInTheDocument();
});

test('default variant shows card with Upgrade CTA', async () => {
  setup({ plan: 'free' });
  const btn = screen.getByRole('button', { name: /upgrade now/i });
  await userEvent.click(btn);
  expect(mockNavigate).toHaveBeenCalledWith('/settings/upgrade');
});

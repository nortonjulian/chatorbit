/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../src/test-utils.js';
import ReactionBar from '../src/components/ReactionBar.jsx';

/* ---- Mantine mock (adds MantineProvider so renderWithRouter works) ---- */
jest.mock('@mantine/core', () => {
  const React = require('react');

  const strip = (props = {}) => {
    const {
      // strip common Mantine-only props
      p, px, py, m, mx, my, c, ta, bg, fs, fw,
      mt, mb, ml, mr, mah, h, w, radius, withBorder, shadow,
      gap, align, justify, wrap, variant, size, color, position,
      withArrow, opened, onChange, // Popover props
      ...rest
    } = props;
    return rest;
  };

  const Group = (p) => React.createElement('div', strip(p), p.children);

  const ActionIcon = ({ children, onClick, ...rest }) =>
    React.createElement(
      'button',
      { type: 'button', onClick, ...strip(rest) },
      children
    );

  const Badge = ({ children, onClick, ...rest }) =>
    React.createElement(
      'button',
      { type: 'button', onClick, ...strip(rest) },
      children
    );

  const Tooltip = ({ label, children }) => {
    const child = React.Children.only(children);
    return React.cloneElement(child, { 'aria-label': label });
  };

  const Popover = ({ children }) =>
    React.createElement(React.Fragment, null, children);
  Popover.Target = ({ children }) =>
    React.createElement(React.Fragment, null, children);
  Popover.Dropdown = ({ children }) =>
    React.createElement('div', null, children);

  const MantineProvider = ({ children }) =>
    React.createElement(React.Fragment, null, children);

  return {
    __esModule: true,
    MantineProvider,
    Group,
    ActionIcon,
    Tooltip,
    Badge,
    Popover,
  };
});

/* ---- axiosClient mock ---- */
const mockPost = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { post: (...a) => mockPost(...a) },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders existing reactions and toggles one via quick picker', async () => {
  const message = {
    id: 10,
    reactionSummary: { '👍': 1, '😂': 0 },
    myReactions: [],
  };

  renderWithRouter(<ReactionBar message={message} currentUserId={1} />);

  // Existing visible reaction
  expect(screen.getByText(/👍 1/)).toBeInTheDocument();

  // Open quick picker (tooltip gives aria-label "Add reaction")
  await userEvent.click(screen.getByRole('button', { name: /add reaction/i }));
  await userEvent.click(screen.getByRole('button', { name: '😂' }));

  // Optimistic update
  expect(message.reactionSummary['😂']).toBe(1);
  expect(message.myReactions).toContain('😂');

  // Server call
  expect(mockPost).toHaveBeenCalledWith('/messages/10/reactions', { emoji: '😂' });
});

/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../src/test-utils.js';
import ReactionBar from '../src/components/ReactionBar.jsx';

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

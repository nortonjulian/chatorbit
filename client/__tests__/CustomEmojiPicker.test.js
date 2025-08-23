import { jest } from '@jest/globals';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../src/test-utils.js';
import CustomEmojiPicker from '../src/components/CustomEmojiPicker.jsx';

// Mock the third-party picker to a simple button that "picks" 😀
jest.mock('emoji-picker-react', () => ({
  __esModule: true,
  default: ({ onEmojiClick }) => (
    <button onClick={() => onEmojiClick({ emoji: '😀' })}>PickEmoji</button>
  ),
}));

test('opens popover and selects emoji', async () => {
  const onSelect = jest.fn();
  renderWithRouter(<CustomEmojiPicker onSelect={onSelect} />);

  // The trigger is the smile icon button
  await userEvent.click(screen.getByRole('button')); // ActionIcon
  // Picker appears (our mock)
  await userEvent.click(screen.getByRole('button', { name: /pickemoji/i }));

  expect(onSelect).toHaveBeenCalledWith('😀');
});

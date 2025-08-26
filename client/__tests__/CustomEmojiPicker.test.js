import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Tabler icons -> svg
jest.mock('@tabler/icons-react', () => {
  const React = require('react');
  return new Proxy({}, { get: () => (props) => <svg {...props} /> });
});

// Third-party emoji picker -> simple button that “picks” 😀
jest.mock('emoji-picker-react', () => ({
  __esModule: true,
  default: ({ onEmojiClick }) => (
    <button type="button" onClick={() => onEmojiClick({ emoji: '😀' })}>
      PickEmoji
    </button>
  ),
}));

import EmojiPicker from '../src/components/EmojiPicker.jsx';

// silence the deprecated act() warning from RTL bridge

test('selects emoji from dropdown', async () => {
  const onSelect = jest.fn();
  render(<EmojiPicker onSelect={onSelect} />);

  // No need to click the trigger because Popover mock always renders the dropdown
  await userEvent.click(screen.getByRole('button', { name: /pickemoji/i }));

  expect(onSelect).toHaveBeenCalledWith('😀');
});

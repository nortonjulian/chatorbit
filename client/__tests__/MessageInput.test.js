import { jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils.js';
import MessageInput from '../src/components/MessageInput.jsx';

const mockPost = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { post: (...a) => mockPost(...a) },
}));

// Replace StickerPicker with a tiny picker button
jest.mock('../src/components/StickerPicker.jsx', () => ({
  __esModule: true,
  default: ({ opened, onPick, onClose }) =>
    opened ? (
      <button
        onClick={() => {
          onPick({ kind: 'STICKER', url: 'http://s' });
          onClose();
        }}
      >
        PickSticker
      </button>
    ) : null,
}));

import MessageInput from '../src/components/MessageInput.jsx';

beforeEach(() => {
  jest.clearAllMocks();
});

test('disables send when nothing to send', () => {
  renderWithRouter(
    <MessageInput chatroomId={123} currentUser={{}} onMessageSent={() => {}} />
  );
  expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
});

test('sends trimmed text and calls onMessageSent', async () => {
  const saved = { id: 9, content: 'hi' };
  mockPost.mockResolvedValueOnce({ data: saved });

  const onMessageSent = jest.fn();
  renderWithRouter(
    <MessageInput chatroomId={5} currentUser={{}} onMessageSent={onMessageSent} />
  );

  await userEvent.type(screen.getByPlaceholderText(/say something/i), '  hi  ');
  await userEvent.click(screen.getByRole('button', { name: /send/i }));

  await waitFor(() => {
    expect(mockPost).toHaveBeenCalled();
    expect(onMessageSent).toHaveBeenCalledWith(saved);
  });
});

test('adds a sticker inline and enables send', async () => {
  mockPost.mockResolvedValueOnce({ data: { id: 1 } });

  renderWithRouter(
    <MessageInput chatroomId={7} currentUser={{}} onMessageSent={() => {}} />
  );

  await userEvent.click(screen.getByRole('button', { name: '😀' })); // opens picker
  await userEvent.click(screen.getByRole('button', { name: /picksticker/i })); // injects sticker

  // With a sticker present, send should be enabled even if text is empty
  const send = screen.getByRole('button', { name: /send/i });
  expect(send).not.toBeDisabled();

  await userEvent.click(send);
  await waitFor(() => expect(mockPost).toHaveBeenCalled());
});

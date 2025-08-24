if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoomSearchDrawer from '../src/components/RoomSearchDrawer.jsx';

const mockSearch = jest.fn();
jest.mock('../src/utils/messagesStore', () => ({
  __esModule: true,
  searchRoom: (...a) => mockSearch(...a),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Always return a match when query has non-whitespace
  mockSearch.mockImplementation((_roomId, q) =>
    Promise.resolve(
      q && q.trim()
        ? [{ id: 1, createdAt: '2030-01-01T10:00:00Z', decryptedContent: 'hello world' }]
        : []
    )
  );
});

test('searches and renders results; clicking calls onJump', async () => {
  const onJump = jest.fn();
  const { renderWithRouter } = require('../src/test-utils');

  renderWithRouter(
    <RoomSearchDrawer opened onClose={() => {}} roomId={99} onJump={onJump} />
  );

  await userEvent.type(
    screen.getByPlaceholderText(/search messages/i),
    'hello'
  );

  // Ensure the last call was made with the final query
  await waitFor(() =>
    expect(mockSearch).toHaveBeenCalledWith(99, expect.stringContaining('hello'))
  );

  // Wait for the result to render
  await waitFor(() =>
    expect(screen.getByText(/hello world/i)).toBeInTheDocument()
  );

  await userEvent.click(screen.getByText(/hello world/i));
  expect(onJump).toHaveBeenCalledWith(1);
});

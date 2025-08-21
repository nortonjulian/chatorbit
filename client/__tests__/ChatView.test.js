import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils.js';
import { jest } from '@jest/globals';
import ChatView from '../src/components/ChatView.jsx';

// socket mock
jest.mock('../src/lib/socket', () => ({
  __esModule: true,
  default: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
}));

// axiosClient mock — define safe mock* fns and export as default
const mockGet = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { get: mockGet },
}));

// encryptionClient mock
const mockDecrypt = jest.fn(async (items) => items);
jest.mock('../src/utils/encryptionClient', () => ({
  __esModule: true,
  decryptFetchedMessages: (...a) => mockDecrypt(...a),
}));

// messagesStore mock
jest.mock('../src/utils/messagesStore', () => ({
  __esModule: true,
  addMessages: () => Promise.resolve(),
}));

// prefsStore mock
jest.mock('../src/utils/prefsStore', () => ({
  __esModule: true,
  getPref: async () => false,
  setPref: async () => {},
  PREF_SMART_REPLIES: 'PREF_SMART_REPLIES',
}));

// smart replies hook mock
jest.mock('../src/hooks/useSmartReplies.js', () => ({
  __esModule: true,
  useSmartReplies: () => ({ suggestions: [], clear: () => {} }),
}));

import ChatView from '../src/components/ChatView.jsx';

beforeEach(() => {
  jest.clearAllMocks();
});

test('shows “Select a chatroom” when no chatroom', () => {
  renderWithRouter(<ChatView currentUserId={1} currentUser={{}} chatroom={null} />);
  expect(screen.getByText(/select a chatroom/i)).toBeInTheDocument();
});

test('loads initial messages and renders room title', async () => {
  mockGet.mockResolvedValueOnce({
    data: {
      items: [
        { id: 2, content: 'Second', sender: { id: 2 } },
        { id: 3, content: 'Third', sender: { id: 1 } },
      ],
      nextCursor: null,
    },
  });

  renderWithRouter(
    <ChatView
      chatroom={{ id: 10, name: 'Room X', participants: [{ id: 1 }, { id: 2 }] }}
      currentUserId={1}
      currentUser={{}}
    />
  );

  expect(screen.getByText('Room X')).toBeInTheDocument();
  await waitFor(() => expect(mockGet).toHaveBeenCalled());

  // One of the messages should be visible
  expect(screen.getByText(/second|third/i)).toBeInTheDocument();
});

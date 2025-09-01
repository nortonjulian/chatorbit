/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils.js';

// Mock premium hook so "@/hooks/useIsPremium" resolves
jest.mock('@/hooks/useIsPremium', () => ({
  __esModule: true,
  default: () => true, // set to false if you want to test the non-premium path
}));

beforeAll(() => {
  // jsdom doesn't implement scrollIntoView; mock it so ChatView's call doesn't throw
  if (!HTMLElement.prototype.scrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: () => {}, // no-op
    });
  }
});

/* ---------- Tame noisy console warnings (optional) ---------- */
/* (left intentionally blank) */

/* ---------- Icons & other heavy deps ---------- */
jest.mock('@tabler/icons-react', () => {
  const React = require('react');
  return new Proxy({}, { get: () => (props) => React.createElement('svg', props) });
});

/* ---------- Lighten children rendered inside ChatView ---------- */
jest.mock('../src/components/MessageInput.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="message-input" />,
}));
jest.mock('../src/components/ReactionBar.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="reaction-bar" />,
}));
jest.mock('../src/components/EventSuggestionBar.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="event-suggest" />,
}));
jest.mock('../src/components/PremiumGuard.jsx', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>,
}));
jest.mock('../src/components/RoomSettingsModal.jsx', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/RoomInviteModal.jsx', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/RoomAboutModal.jsx', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/RoomSearchDrawer.jsx', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/MediaGalleryModal.jsx', () => ({ __esModule: true, default: () => null }));

/* ---------- Networking & helpers ---------- */
jest.mock('../src/api/axiosClient', () => {
  const get = jest.fn();
  const post = jest.fn();
  return { __esModule: true, default: { get, post } };
});
jest.mock('../src/utils/encryptionClient', () => {
  const decryptFetchedMessages = jest.fn(async (items) =>
    items.map((i) => ({ ...i, decryptedContent: i.decryptedContent ?? i.content }))
  );
  return { __esModule: true, decryptFetchedMessages };
});
jest.mock('../src/utils/messagesStore', () => ({ __esModule: true, addMessages: () => Promise.resolve() }));
jest.mock('../src/utils/prefsStore', () => ({
  __esModule: true,
  getPref: async () => false,
  setPref: async () => {},
  PREF_SMART_REPLIES: 'PREF_SMART_REPLIES',
}));
jest.mock('../src/hooks/useSmartReplies.js', () => ({
  __esModule: true,
  useSmartReplies: () => ({ suggestions: [], clear: () => {} }),
}));
jest.mock('../src/lib/socket', () => ({ __esModule: true, default: { on: jest.fn(), off: jest.fn(), emit: jest.fn() } }));

/* ---------- Import under test (AFTER mocks) ---------- */
import ChatView from '../src/components/ChatView.jsx';
import axiosClient from '../src/api/axiosClient';

beforeEach(() => {
  jest.clearAllMocks();
});

test('shows “Select a chatroom” when no chatroom', () => {
  renderWithRouter(<ChatView currentUserId={1} currentUser={{}} chatroom={null} />);
  expect(screen.getByText(/select a chatroom/i)).toBeInTheDocument();
});

test('loads initial messages and renders room title', async () => {
  axiosClient.get.mockResolvedValueOnce({
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

  // Room title appears immediately
  expect(screen.getByText('Room X')).toBeInTheDocument();

  // First page requested
  await waitFor(() => expect(axiosClient.get).toHaveBeenCalled());

  // Decrypted & rendered items show up
  expect(await screen.findByText(/second/i)).toBeInTheDocument();
  expect(await screen.findByText(/third/i)).toBeInTheDocument();
});

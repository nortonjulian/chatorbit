/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils.js';

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
let origError;
beforeAll(() => {
  origError = console.error;
  jest.spyOn(console, 'error').mockImplementation((msg = '', ...rest) => {
    const text = String(msg);
    if (
      text.includes('ReactDOMTestUtils.act is deprecated') ||
      text.includes('not wrapped in act(') ||
      text.includes('React does not recognize the `leftSection` prop')
    ) {
      return;
    }
    origError(msg, ...rest);
  });
});
afterAll(() => {
  console.error.mockRestore();
});

/* ---------- Inline Mantine mock (minimal + safe) ---------- */
jest.mock('@mantine/core', () => {
  const React = require('react');

  // strip Mantine-only props so they don't hit the DOM
  const strip = (props = {}) => {
    const {
      p, px, py, m, mx, my, c, ta, bg, fs, fw, mt, mb, ml, mr, mah, h, w,
      radius, withBorder, shadow, variant, size, gap, align, justify, wrap,
      centered, position, withArrow, padding, color,
      leftSection, rightSection, viewportRef,
      // anything else not valid DOM:
      ...rest
    } = props;
    return rest;
  };

  const passthrough = (tag = 'div') =>
    React.forwardRef((props, ref) =>
      React.createElement(tag, { ...strip(props), ref }, props.children)
    );

  const ButtonLike = React.forwardRef((props, ref) =>
    React.createElement('button', { type: 'button', ...strip(props), ref }, props.children)
  );

  const Modal = ({ opened, onClose, title, children, ...rest }) =>
    // represent a modal as a simple dialog container
    React.createElement(
      'div',
      { role: 'dialog', 'aria-label': title ?? rest['aria-label'], ...strip(rest) },
      children
    );

  const MantineProvider = ({ children }) => React.createElement(React.Fragment, null, children);

  // Return a proxy so ANY named import from '@mantine/core' works.
  return new Proxy(
    {
      __esModule: true,
      MantineProvider,
      Modal,
      Button: ButtonLike,
      ActionIcon: ButtonLike,
      TextInput: passthrough('input'),
      Textarea: passthrough('textarea'),
      Anchor: (p) => React.createElement('a', strip(p), p.children),
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        // Unknown components become simple <div> wrappers
        return passthrough('div');
      },
    }
  );
});

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

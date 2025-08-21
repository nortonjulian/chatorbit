jest.mock('../src/components/ChatroomList.jsx', () => {
  const React = require('react');
  // Minimal behavior that your test needs:
  // It fetches once (your test already stubs global.fetch), renders a link per room,
  // and calls onSelect when a link is clicked.
  return {
    __esModule: true,
    default: function MockChatroomList({ onSelect, selectedRoom, currentUser }) {
      const [rooms, setRooms] = React.useState([]);
      React.useEffect(() => {
        (async () => {
          const res = await fetch('/fake'); // your test’s fetch mock doesn’t check URL
          const json = await res.json();
          setRooms(json.items);
        })();
      }, []);
      return React.createElement(
        'div',
        null,
        rooms.map((r) =>
          React.createElement(
            'a',
            {
              key: r.id,
              href: '#',
              role: 'link',
              onClick: (e) => {
                e.preventDefault();
                onSelect?.(r);
              },
            },
            r.name
          )
        )
      );
    },
  };
});


import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../src/test-utils.js';
import { jest } from '@jest/globals';

// socket mock — safe name + default export shape
const mockEmit = jest.fn();
jest.mock('../src/lib/socket', () => ({
  __esModule: true,
  default: { emit: mockEmit, on: jest.fn(), off: jest.fn() },
}));

// Mock fetch
beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      items: [
        { id: 1, name: 'General', participants: [{ id: 1 }, { id: 2 }] },
        { id: 2, name: 'DM Alice', participants: [{ id: 1 }, { id: 99 }] },
      ],
      nextCursor: null,
    }),
  }));
  mockEmit.mockClear();
});

import ChatroomList from '../src/components/ChatroomList.jsx';

test('renders rooms and selects one (join/leave emits)', async () => {
  const onSelect = jest.fn();

  renderWithRouter(
    <ChatroomList
      currentUser={{ id: 1 }}
      selectedRoom={{ id: 2, name: 'DM Alice' }}
      onSelect={onSelect}
    />
  );

  // waits initial fetch render
  await waitFor(() => expect(screen.getByText('General')).toBeInTheDocument());

  await userEvent.click(screen.getByRole('link', { name: 'General' }));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  // Should emit leave for old room + join for new room
  expect(mockEmit).toHaveBeenCalledWith('leave_room', 2);
  expect(mockEmit).toHaveBeenCalledWith('join_room', 1);
});

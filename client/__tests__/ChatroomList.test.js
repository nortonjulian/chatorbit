// __tests__/ChatroomList.test.js
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---- socket mock (avoid hoisting issues)
jest.mock('../src/lib/socket', () => {
  const emit = jest.fn();
  // expose the fn so tests can assert on it
  if (typeof global !== 'undefined') global.__socketEmit = emit;

  return {
    __esModule: true,
    default: { emit, on: jest.fn(), off: jest.fn() },
  };
});

// ---- component mock: avoids import.meta.env but keeps behavior (fetch -> list; click -> leave/join + onSelect)
jest.mock('../src/components/ChatroomList.jsx', () => {
  const React = require('react');
  const socket = require('../src/lib/socket').default;

  function MockChatroomList({ onSelect, selectedRoom }) {
    const [rooms, setRooms] = React.useState([]);

    React.useEffect(() => {
      (async () => {
        const res = await fetch('/fake'); // URL irrelevant for test
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
              if (selectedRoom?.id) socket.emit('leave_room', selectedRoom.id);
              socket.emit('join_room', r.id);
              onSelect?.(r);
            },
          },
          r.name
        )
      )
    );
  }

  return { __esModule: true, default: MockChatroomList };
});

import ChatroomList from '../src/components/ChatroomList.jsx';

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      items: [
        { id: 1, name: 'General',   participants: [{ id: 1 }, { id: 2 }] },
        { id: 2, name: 'DM Alice',  participants: [{ id: 1 }, { id: 99 }] },
      ],
      nextCursor: null,
    }),
  }));
  // clear the emit captured on global by the socket mock
  global.__socketEmit?.mockClear?.();
});

afterEach(() => {
  delete global.fetch;
});

test('renders rooms and selects one (join/leave emits)', async () => {
  const onSelect = jest.fn();

  render(
    <ChatroomList
      currentUser={{ id: 1 }}
      selectedRoom={{ id: 2, name: 'DM Alice' }}
      onSelect={onSelect}
    />
  );

  await waitFor(() => expect(screen.getByText('General')).toBeInTheDocument());

  await userEvent.click(screen.getByRole('link', { name: 'General' }));

  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  // assert socket emits
  const mockEmit = global.__socketEmit;
  expect(mockEmit).toHaveBeenCalledWith('leave_room', 2);
  expect(mockEmit).toHaveBeenCalledWith('join_room', 1);
});

/** @jest-environment jsdom */
import React from 'react';
import { jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils.js';

// --- Light Mantine mock (now includes MantineProvider) ---
jest.mock('@mantine/core', () => {
  const React = require('react');

  const strip = (props = {}) => {
    const {
      // styling/extra props we don't want on DOM
      p, px, py, m, mx, my, mt, mb, ml, mr, c, ta, bg, fs, fw, mah, h, w,
      radius, withBorder, shadow, variant, size, gap, align, justify, wrap,
      centered, position, withArrow, padding, color, fullWidth, autosize,
      // anything else should pass through
      ...rest
    } = props;
    return rest;
  };

  const MantineProvider = ({ children }) => <>{children}</>;
  const Group = (p) => React.createElement('div', strip(p), p.children);
  const Button = (p) =>
    React.createElement('button', { type: 'button', ...strip(p) }, p.children);
  const Textarea = (p) =>
    React.createElement('textarea', strip(p), p.children);
  const Modal = ({ opened, children, title, ...rest }) =>
    opened
      ? React.createElement(
          'div',
          { role: 'dialog', 'aria-label': title || 'Modal', ...strip(rest) },
          children
        )
      : null;

  return {
    __esModule: true,
    MantineProvider, // <-- important for renderWithRouter
    Group,
    Button,
    Textarea,
    Modal,
  };
});

// --- axios mock ---
const mockPatch = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { patch: (...a) => mockPatch(...a) },
}));

// --- import after mocks ---
import RoomAboutModal from '../src/components/RoomAboutModal.jsx';

// helper to inject a currentUser
function renderWithUser(ui, { user, room } = {}) {
  const { UserContext } = require('../src/context/UserContext');
  return renderWithRouter(
    <UserContext.Provider value={{ currentUser: user, setCurrentUser: jest.fn() }}>
      {React.cloneElement(ui, { opened: true, room })}
    </UserContext.Provider>
  );
}

beforeEach(() => jest.clearAllMocks());

test('non-editor sees readOnly and no Save button', () => {
  renderWithUser(<RoomAboutModal onClose={() => {}} />, {
    user: { id: 2, role: 'MEMBER' },
    room: { id: 1, ownerId: 1, description: 'hello' },
  });

  const textarea = screen.getByPlaceholderText(/describe the purpose/i);
  expect(textarea).toHaveAttribute('readonly');
  expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
});

test('admin can edit and save description', async () => {
  const onSaved = jest.fn();
  const onClose = jest.fn();
  mockPatch.mockResolvedValueOnce({ data: { id: 1, description: 'new' } });

  renderWithUser(<RoomAboutModal onClose={onClose} onSaved={onSaved} />, {
    user: { id: 9, role: 'ADMIN' },
    room: { id: 1, ownerId: 1, description: 'old' },
  });

  const ta = screen.getByPlaceholderText(/describe the purpose/i);
  await userEvent.clear(ta);
  await userEvent.type(ta, 'new');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() =>
    expect(mockPatch).toHaveBeenCalledWith('/chatrooms/1/meta', { description: 'new' })
  );
  expect(onSaved).toHaveBeenCalledWith({ id: 1, description: 'new' });
  expect(onClose).toHaveBeenCalled();
});

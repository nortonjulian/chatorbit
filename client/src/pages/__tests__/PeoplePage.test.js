import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PeoplePage from '../PeoplePage';
import { UserContext } from '../../context/UserContext';

// Mock the modal to avoid heavy parsing/UI in this test
jest.mock('../../components/contacts/ImportContactsModal', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ opened }) =>
      opened ? React.createElement('div', { 'data-testid': 'import-modal' }, 'import-open') : null,
  };
});

jest.mock('../../components/StartChatModal', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ onClose }) =>
      React.createElement('div', { 'data-testid': 'startchat-modal', onClick: onClose }, 'startchat'),
  };
});

jest.mock('../../components/ContactList', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'contact-list' }, 'contacts'),
  };
});

function renderWithUser(ui) {
  const value = { currentUser: { id: 1, username: 'julian' } };
  return render(
    React.createElement(UserContext.Provider, { value }, ui)
  );
}

test('opens Import Contacts modal', () => {
  renderWithUser(React.createElement(PeoplePage));
  expect(screen.queryByTestId('import-modal')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /import contacts/i }));
  expect(screen.getByTestId('import-modal')).toBeInTheDocument();
});

test('search input updates query param on Search', () => {
  renderWithUser(React.createElement(PeoplePage));
  const input = screen.getByPlaceholderText(/search contacts/i);
  fireEvent.change(input, { target: { value: 'alice' } });
  fireEvent.click(screen.getByRole('button', { name: /search/i }));
  expect(new URL(window.location.href).searchParams.get('q')).toBe('alice');
});

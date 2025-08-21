/**
 * @file ContactList.test.js
 * Tests for client/src/components/ContactList.jsx
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// SUT
import ContactList from '../src/components/ContactList.jsx';

// ---- Mocks ----
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const real = jest.requireActual('react-router-dom');
  return { ...real, useNavigate: () => mockNavigate };
});

// axiosClient mock — proper default export and safe names
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
const mockPatch = jest.fn();

jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: {
    get: (...a) => mockGet(...a),
    post: (...a) => mockPost(...a),
    delete: (...a) => mockDelete(...a),
    patch: (...a) => mockPatch(...a),
  },
}));

import axiosClient from '../src/api/axiosClient';

beforeEach(() => {
  jest.clearAllMocks();
});

const renderSut = (props = {}) =>
  render(
    <MemoryRouter>
      <ContactList currentUserId={props.currentUserId ?? 1} onChanged={props.onChanged} />
    </MemoryRouter>
  );

describe('ContactList', () => {
  test('loads and displays contacts; filters by search', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        { userId: 2, alias: '', user: { username: 'alice' } },
        { userId: 3, alias: 'Bobby', user: { username: 'bob' } },
      ],
    });

    renderSut();

    // Title renders
    expect(screen.getByText(/saved contacts/i)).toBeInTheDocument();

    // Wait for contacts to appear
    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(screen.getByText('Bobby')).toBeInTheDocument();

    // Filter to only "ali"
    fireEvent.change(screen.getByPlaceholderText(/search contacts/i), {
      target: { value: 'ali' },
    });

    // "alice" stays, "Bobby" disappears
    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(screen.queryByText('Bobby')).not.toBeInTheDocument();
  });

  test('clicking a contact starts a chat and navigates to the room', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ userId: 42, alias: '', user: { username: 'zoe' } }],
    });
    mockPost.mockResolvedValueOnce({ data: { id: 777 } }); // /chatrooms/direct/:userId

    renderSut();

    // Wait until "zoe" shows up
    expect(await screen.findByText('zoe')).toBeInTheDocument();

    // Clicking the row should trigger startChat
    fireEvent.click(screen.getByText('zoe'));

    expect(mockPost).toHaveBeenCalledWith('/chatrooms/direct/42');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/chat/777'));
  });

  test('delete contact calls API and refreshes the list', async () => {
    // Initial GET
    mockGet.mockResolvedValueOnce({
      data: [{ userId: 9, alias: '', user: { username: 'nina' } }],
    });
    // DELETE
    mockDelete.mockResolvedValueOnce({ status: 200 });
    // Refresh GET after delete
    mockGet.mockResolvedValueOnce({ data: [] });

    const onChanged = jest.fn();
    renderSut({ onChanged });

    expect(await screen.findByText('nina')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith('/contacts', {
        data: { ownerId: 1, userId: 9 },
      })
    );

    // After refresh, "nina" should be gone and "No contacts found." displayed
    expect(await screen.findByText(/no contacts found/i)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  test('editing alias triggers PATCH on blur', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ userId: 5, alias: '', user: { username: 'amy' } }],
    });
    mockPatch.mockResolvedValueOnce({ status: 200 });
    // refresh after patch
    mockGet.mockResolvedValueOnce({
      data: [{ userId: 5, alias: 'Bestie', user: { username: 'amy' } }],
    });

    renderSut();

    expect(await screen.findByText('amy')).toBeInTheDocument();

    const aliasInput = screen.getByPlaceholderText(/alias/i);
    fireEvent.change(aliasInput, { target: { value: 'Bestie' } });
    fireEvent.blur(aliasInput);

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/contacts', {
        ownerId: 1,
        userId: 5,
        alias: 'Bestie',
      })
    );

    // After refresh the alias should now render
    expect(await screen.findByText('Bestie')).toBeInTheDocument();
  });
});

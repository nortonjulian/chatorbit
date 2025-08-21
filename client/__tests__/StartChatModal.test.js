import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StartChatModal from '../src/components/StartChatModal.jsx';

// axiosClient mock (top-level)
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();

jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: {
    get: (...a) => mockGet(...a),
    post: (...a) => mockPost(...a),
    patch: (...a) => mockPatch(...a),
    delete: (...a) => mockDelete(...a),
  },
}));


beforeEach(() => {
  jest.clearAllMocks();
  // initial contacts load
  mockGet.mockResolvedValueOnce({ data: [] }); // GET /contacts/:id
});

test('searches users, saves contact and starts chat', async () => {
  // search returns a user (id 2)
  mockGet.mockResolvedValueOnce({ data: [{ id: 2, username: 'alice' }] }); // GET /users/search
  // refresh contacts after save
  mockGet.mockResolvedValueOnce({ data: [{ userId: 2, alias: '' }] }); // GET /contacts/:id
  // create chatroom
  mockPost.mockResolvedValueOnce({ data: { id: 123 } }); // POST /chatrooms/direct/2

  const onClose = jest.fn();
  const { render } = require('../src/test-utils');
  render(<StartChatModal currentUserId={1} onClose={onClose} />);

  await userEvent.type(screen.getByPlaceholderText(/search by username/i), 'alice');
  await userEvent.click(screen.getByRole('button', { name: /search/i }));

  await waitFor(() =>
    expect(mockGet).toHaveBeenCalledWith('/users/search', { params: { query: 'alice' } })
  );
  expect(await screen.findByText(/alice/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/contacts', {
      ownerId: 1,
      userId: 2,
      alias: undefined,
    })
  );

  await userEvent.click(screen.getByRole('button', { name: /^start$/i }));
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/chatrooms/direct/2'));

  expect(onClose).toHaveBeenCalled(); // navigates after start
});

test('Add Contact (direct) path falls back to external contact', async () => {
  // search for the direct input yields no user
  mockGet.mockResolvedValueOnce({ data: [] }); // GET /users/search (for addContactDirect)
  // saving external contact + invite
  mockPost.mockResolvedValueOnce({}); // POST /contacts (external)
  mockPost.mockResolvedValueOnce({}); // POST /invites (fire and forget)
  // refresh contacts
  mockGet.mockResolvedValueOnce({ data: [] }); // GET /contacts/:id

  const { render } = require('../src/test-utils');
  render(<StartChatModal currentUserId={1} onClose={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: /add/i }));
  await userEvent.type(screen.getByPlaceholderText(/username or phone/i), '555-555-5555');
  await userEvent.type(screen.getByPlaceholderText(/alias \(optional\)/i), 'Bob');
  await userEvent.click(screen.getByRole('button', { name: /save contact/i }));

  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith(
      '/contacts',
      expect.objectContaining({ externalPhone: '555-555-5555' })
    )
  );
});

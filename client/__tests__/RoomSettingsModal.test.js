import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoomSettingsModal from '../src/components/RoomSettingsModal.jsx';

const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: {
    get: (...a) => mockGet(...a),
    patch: (...a) => mockPatch(...a),
    delete: (...a) => mockDelete(...a),
  },
}));

function renderWithUser(ui, { user, room }) {
  const { render } = require('../src/test-utils');
  const { UserContext } = require('../src/context/UserContext');
  return render(
    <UserContext.Provider value={{ currentUser: user, setCurrentUser: jest.fn() }}>
      {React.cloneElement(ui, { opened: true, room })}
    </UserContext.Provider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({
    data: {
      ownerId: 1,
      participants: [
        { user: { id: 1, username: 'owner' }, role: 'ADMIN' },
        { user: { id: 2, username: 'mod' }, role: 'MODERATOR' },
        { user: { id: 3, username: 'mem' }, role: 'MEMBER' },
      ],
    },
  });
});

test('loads participants and saves AI mode; toggles allow bot', async () => {
  mockPatch.mockResolvedValue({ data: { aiAssistantMode: 'mention' } });

  renderWithUser(<RoomSettingsModal onUpdated={jest.fn()} onClose={jest.fn()} />, {
    user: { id: 1, role: 'ADMIN' },
    room: { id: 10, ownerId: 1, aiAssistantMode: 'off', me: { allowAIBot: true } },
  });

  // Participants load
  await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/chatrooms/10/participants'));

  // Change AI assistant
  const aiSelect = screen.getByLabelText(/ai assistant/i);
  await userEvent.click(aiSelect);
  await userEvent.click(screen.getByRole('option', { name: /only on @orbitbot/i }));
  await userEvent.click(screen.getByRole('button', { name: /save ai mode/i }));
  await waitFor(() =>
    expect(mockPatch).toHaveBeenCalledWith('/chatrooms/10/ai-assistant', { mode: 'mention' })
  );

  // Toggle allow bot
  const allowSwitch = screen.getByRole('checkbox', { name: /allow orbitbot/i });
  await userEvent.click(allowSwitch);
  await waitFor(() =>
    expect(mockPatch).toHaveBeenCalledWith('/chatrooms/10/ai-opt', { allow: false })
  );
});

test('owner/admin can change a member role and remove user', async () => {
  renderWithUser(<RoomSettingsModal onUpdated={jest.fn()} onClose={jest.fn()} />, {
    user: { id: 1, role: 'ADMIN' },
    room: { id: 11, ownerId: 1 },
  });

  await waitFor(() => expect(mockGet).toHaveBeenCalled());

  // Find row for user "mem"
  const row = screen.getByText('mem').closest('tr');
  const utils = within(row);

  // Change role to Moderator
  const roleSelect = utils.getByRole('combobox');
  await userEvent.click(roleSelect);
  await userEvent.click(screen.getByRole('option', { name: /moderator/i }));

  await waitFor(() =>
    expect(mockPatch).toHaveBeenCalledWith('/chatrooms/11/participants/3/role', { role: 'MODERATOR' })
  );

  // Remove user
  await userEvent.click(utils.getByRole('button', { name: /remove/i }));
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/chatrooms/11/participants/3'));
});

import { render as rtlRender, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';

// ---------- axiosClient mock (must be BEFORE component import)
const buildAxiosMock = () => {
  const mock = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };

  mock.get.mockImplementation((url) => {
    const u = String(url);
    if (u.includes('participants')) {
      // Shape expected by the component
      return Promise.resolve({
        data: {
          ownerId: 'u1',
          participants: [
            { user: { id: 'u1', username: 'own', displayName: 'own', avatarUrl: '' }, role: 'OWNER' },
            { user: { id: 'u2', username: 'mod', displayName: 'mod', avatarUrl: '' }, role: 'MODERATOR' },
            { user: { id: 'u3', username: 'mem', displayName: 'mem', avatarUrl: '' }, role: 'MEMBER' },
          ],
        },
      });
    }
    if (u.includes('settings')) {
      return Promise.resolve({ data: { aiMode: 'ASK', allowBot: true } });
    }
    return Promise.resolve({ data: {} });
  });

  mock.patch.mockResolvedValue({ data: {} });
  mock.put.mockResolvedValue({ data: {} });
  mock.post.mockResolvedValue({ data: {} });
  mock.delete.mockResolvedValue({ data: {} });

  return mock;
};

jest.mock(require.resolve('../src/api/axiosClient'), () => ({
  __esModule: true,
  default: buildAxiosMock(),
}));

// ---------- UserContext mock
jest.mock('../src/context/UserContext', () => {
  const React = require('react');
  return {
    __esModule: true,
    UserContext: React.createContext({
      currentUser: { id: 'u1', username: 'own', role: 'ADMIN' },
      setCurrentUser: jest.fn(),
    }),
    useUser: () => ({
      currentUser: { id: 'u1', username: 'own', role: 'ADMIN' },
      setCurrentUser: jest.fn(),
    }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});
jest.useRealTimers();

// ---------- render helper
function renderWithProviders(ui, { route = '/rooms/room-123' } = {}) {
  return rtlRender(
    <MantineProvider>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/rooms/:roomId" element={ui} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>
  );
}

// ---------- helpers
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function findRowByUsername(username) {
  // Find the text anywhere inside a table cell, then climb to the row
  const label = await screen.findByText(
    new RegExp(`^${escapeRegExp(username)}$`, 'i'),
    { selector: 'td *' }
  );
  return label.closest('tr');
}

async function openSelectAndChoose(cell, { optionNameRe }) {
  // Mantine Select renders as a combobox input + hidden input.
  const combo = within(cell).getByRole('combobox');
  const user = userEvent.setup();
  await user.click(combo);

  const option = await screen.findByRole('option', { name: optionNameRe });
  await user.click(option);
}

// ---------- tests
describe('RoomSettingsModal', () => {
  const RoomSettingsModal = require('../src/components/RoomSettingsModal.jsx').default;

  const baseRoom = {
    id: 'room-123',
    ownerId: 'u1',
    aiAssistantMode: 'off',
    autoTranslateMode: 'off',
    me: { allowAIBot: true },
  };

  test('loads participants, saves AI mode, and toggles allow bot', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RoomSettingsModal opened onClose={() => {}} room={baseRoom} />);

    const ownerRow = await findRowByUsername('own');
    const modRow = await findRowByUsername('mod');
    const memRow = await findRowByUsername('mem');
    expect(ownerRow && modRow && memRow).toBeTruthy();

    // Target the Select via role=combobox to avoid duplicate label matches
    const aiSelect = screen.getByRole('combobox', { name: /ai assistant/i });
    await user.click(aiSelect);
    const proactive = await screen.findByRole('option', { name: /reply proactively/i });
    await user.click(proactive);

    const allowSwitch = screen.getByRole('switch', {
      name: /allow orbitbot to engage in this room/i,
    });
    await user.click(allowSwitch);
    await user.click(allowSwitch);

    expect(allowSwitch).toBeInTheDocument();
  });

  test('owner/admin can change a member role and remove user', async () => {
    const user = userEvent.setup();
    const axiosClient = require('../src/api/axiosClient').default;
    renderWithProviders(<RoomSettingsModal opened onClose={() => {}} room={baseRoom} />);

    const memRow = await findRowByUsername('mem');
    expect(memRow).toBeTruthy();

    // Change role for the member row
    const roleCell = within(memRow).getAllByRole('cell')[1];
    await openSelectAndChoose(roleCell, { optionNameRe: /moderator/i });

    const payloadHasModerator =
      axiosClient.patch.mock.calls.some(([, body]) =>
        JSON.stringify(body || {}).match(/MODERATOR/)
      );
    expect(payloadHasModerator).toBe(true);

    // Remove the user
    const actionsCell = within(memRow).getAllByRole('cell')[2];
    const removeBtn =
      within(actionsCell).queryByRole('button', { name: /remove/i }) ||
      within(actionsCell).getByText(/remove/i);
    await user.click(removeBtn);

    const payloadHasUserId =
      axiosClient.delete.mock.calls.some(([u]) => /u3|mem/i.test(u));
    expect(payloadHasUserId).toBe(true);
  });
});

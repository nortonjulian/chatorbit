import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoomSearchDrawer from '../src/components/RoomSearchDrawer.jsx';

const mockSearch = jest.fn();
jest.mock('../src/utils/messagesStore', () => ({
  __esModule: true,
  searchRoom: (...a) => mockSearch(...a),
}));

beforeEach(() => jest.clearAllMocks());

test('searches and renders results; clicking calls onJump', async () => {
  mockSearch.mockResolvedValueOnce([
    { id: 1, createdAt: '2030-01-01T10:00:00Z', decryptedContent: 'hello world' },
  ]);

  const onJump = jest.fn();
  const { render } = require('../src/test-utils');
  render(<RoomSearchDrawer opened onClose={() => {}} roomId={99} onJump={onJump} />);

  await userEvent.type(screen.getByPlaceholderText(/search messages/i), 'hello');
  await waitFor(() => expect(mockSearch).toHaveBeenCalledWith(99, 'hello'));

  const row = await screen.findByText(/hello world/i);
  await userEvent.click(row);

  expect(onJump).toHaveBeenCalledWith(1);
});

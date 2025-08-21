import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../src/test-utils';
import StickerPicker from '../src/components/StickerPicker.jsx';

// axiosClient mock
const mockGet = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { get: (...a) => mockGet(...a) },
}));

// Import after mocks
import StickerPicker from '../src/components/StickerPicker.jsx';

beforeEach(() => {
  jest.clearAllMocks();
});

test('searches after 2 chars and picks a result', async () => {
  mockGet.mockResolvedValueOnce({
    data: {
      results: [
        { id: '1', url: 'http://gif/1.gif', thumb: 't1', kind: 'GIF' },
        { id: '2', url: 'http://gif/2.gif', thumb: 't2', kind: 'STICKER' },
      ],
    },
  });

  const onPick = jest.fn();
  const onClose = jest.fn();

  renderWithRouter(<StickerPicker opened onPick={onPick} onClose={onClose} />);

  const input = screen.getByPlaceholderText(/search gifs/i);
  await userEvent.type(input, 'he');

  await waitFor(() => expect(mockGet).toHaveBeenCalled());

  // Click the first image result
  const img = await screen.findByRole('img', { name: /sticker/i });
  await userEvent.click(img);

  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://gif/1.gif' }));
  expect(onClose).toHaveBeenCalled();
});

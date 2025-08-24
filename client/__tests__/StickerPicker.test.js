import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import StickerPicker from '../src/components/StickerPicker.jsx';

// --- axiosClient mock
const mockGet = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { get: (...a) => mockGet(...a) },
}));

// --- Local render helper: Mantine + Router (works with Mantine Modal portal)
function renderWithProviders(ui) {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={ui} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>
  );
}

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

  renderWithProviders(<StickerPicker opened onPick={onPick} onClose={onClose} />);

  const input = screen.getByPlaceholderText(/search gifs \(powered by tenor\)/i);

  // typing 1 char should NOT trigger a search
  await userEvent.type(input, 'h');
  expect(mockGet).not.toHaveBeenCalled();

  // typing second char triggers the search with trimmed query
  await userEvent.type(input, 'e');

  await waitFor(() =>
    expect(mockGet).toHaveBeenCalledWith('/stickers/search', {
      params: { q: 'he' },
    })
  );

  // Click the first image result
  const imgs = await screen.findAllByRole('img', { name: /sticker/i });
  expect(imgs).toHaveLength(2);

  await userEvent.click(imgs[0]);

  expect(onPick).toHaveBeenCalledWith(
    expect.objectContaining({ url: 'http://gif/1.gif', kind: 'GIF' })
  );
  expect(onClose).toHaveBeenCalled();
});

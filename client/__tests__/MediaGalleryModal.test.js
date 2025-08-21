import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MediaGalleryModal from '../src/components/MediaGalleryModal.jsx';

const mockGetMediaInRoom = jest.fn();
jest.mock('../src/utils/messagesStore', () => ({
  __esModule: true,
  getMediaInRoom: (...a) => mockGetMediaInRoom(...a),
}));

beforeEach(() => jest.clearAllMocks());

test('renders images and opens viewer', async () => {
  mockGetMediaInRoom.mockResolvedValueOnce([
    { id: 1, kind: 'IMAGE', url: 'http://x/img.jpg', caption: 'pic1' },
    { id: 2, kind: 'VIDEO', url: 'http://x/v.mp4' },
    { id: 3, kind: 'AUDIO', url: 'http://x/a.mp3' },
  ]);

  const { render, findByRole } = require('../src/test-utils');
  render(<MediaGalleryModal opened roomId={5} onClose={() => {}} />);

  // Image thumb appears
  expect(await findByRole('img', { name: /pic1/i })).toBeInTheDocument();

  // Click image to open viewer
  await userEvent.click(screen.getByRole('img', { name: /pic1/i }));
  // Viewer title uses caption
  expect(await findByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText(/pic1/i)).toBeInTheDocument();
});

import { act } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import StatusBar from '../src/components/StatusBar';

jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock('../src/lib/socket', () => ({
  __esModule: true,
  default: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('../src/utils/encryptionClient', () => ({
  __esModule: true,
  decryptFetchedMessages: jest.fn(),
}));

import axiosClient from '../src/api/axiosClient';
import socket from '../src/lib/socket';
import { decryptFetchedMessages } from '../src/utils/encryptionClient';

const FEED = [
  { id: 's1', author: { id: 'u1', username: 'alice', avatarUrl: '/a.png' }, captionCiphertext: 'c1', encryptedKeyForMe: 'ek1', viewerSeen: false, assets: [] },
  { id: 's2', author: { id: 'u1', username: 'alice', avatarUrl: '/a.png' }, captionCiphertext: 'c2', encryptedKeyForMe: 'ek2', viewerSeen: true,  assets: [] },
  { id: 's3', author: { id: 'u2', username: 'bob',   avatarUrl: '/b.png' }, captionCiphertext: 'c3', encryptedKeyForMe: 'ek3', viewerSeen: true,  assets: [] },
];

describe('StatusBar', () => {
  beforeEach(() => jest.clearAllMocks());

  test('loads, decrypts, groups by author, renders tooltips', async () => {
    axiosClient.get.mockResolvedValueOnce({ data: FEED });
    decryptFetchedMessages.mockResolvedValueOnce([
      { id: 's1', decryptedContent: 'hello 1' },
      { id: 's2', decryptedContent: 'hello 2' },
      { id: 's3', decryptedContent: 'hello 3' },
    ]);

    render(<StatusBar currentUserId="me" onOpenViewer={jest.fn()} />);

    expect(await screen.findByText(/Loading status/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/alice — 2 posts/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bob — 1 post/i)).toBeInTheDocument();
  });

  test('clicking author calls onOpenViewer with grouped stories', async () => {
    axiosClient.get.mockResolvedValue({ data: FEED });
    decryptFetchedMessages.mockResolvedValue([
      { id: 's1', decryptedContent: 'hello 1' },
      { id: 's2', decryptedContent: 'hello 2' },
      { id: 's3', decryptedContent: 'hello 3' },
    ]);

    const onOpenViewer = jest.fn();
    render(<StatusBar currentUserId="me" onOpenViewer={onOpenViewer} />);

    await screen.findByText('alice');

    fireEvent.click(screen.getByText('alice'));
    expect(onOpenViewer).toHaveBeenCalledTimes(1);
    const { author, stories } = onOpenViewer.mock.calls[0][0];
    expect(author.username).toBe('alice');
    expect(stories).toHaveLength(2);
  });

  test('reloads on socket events', async () => {
    axiosClient.get.mockResolvedValue({ data: FEED });
    decryptFetchedMessages.mockResolvedValue([
      { id: 's1', decryptedContent: 'hello 1' },
      { id: 's2', decryptedContent: 'hello 2' },
      { id: 's3', decryptedContent: 'hello 3' },
    ]);

    render(<StatusBar currentUserId="me" />);

    await screen.findByText('alice');

    expect(socket.on).toHaveBeenCalledWith('status_posted', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('status_expired', expect.any(Function));

    const onPosted = socket.on.mock.calls.find(c => c[0] === 'status_posted')[1];
    axiosClient.get.mockResolvedValueOnce({ data: [] });
    decryptFetchedMessages.mockResolvedValueOnce([]);
    await act(async () => {
    onPosted();
    });
    await waitFor(() => {
      expect(screen.queryByText('alice')).not.toBeInTheDocument();
    });
  });
});

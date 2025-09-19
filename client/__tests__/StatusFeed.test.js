import { screen, waitFor, render } from './test-utils.jsx';
import api from '@/api/axiosClient';
import StatusFeed from '@/pages/StatusFeed.js';

jest.mock('@/api/axiosClient');

describe('StatusFeed', () => {
  afterEach(() => jest.clearAllMocks());

  test('renders statuses after loading', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: 1, author: { username: 'alice' }, body: 'hello', createdAt: '2025-01-01T00:00:00Z' },
          { id: 2, author: { username: 'bob' }, body: 'world', createdAt: '2025-01-02T00:00:00Z' },
        ],
      },
    });

    render(<StatusFeed />, { wrapper: ({ children }) => children });

    await waitFor(() => {
      expect(screen.getByText(/hello/i)).toBeInTheDocument();
      expect(screen.getByText(/world/i)).toBeInTheDocument();
      expect(screen.getByText(/alice/i)).toBeInTheDocument();
      expect(screen.getByText(/bob/i)).toBeInTheDocument();
    });
  });

  test('shows empty state', async () => {
    api.get.mockResolvedValueOnce({ data: { items: [] } });
    render(<StatusFeed />, { wrapper: ({ children }) => children });

    await waitFor(() => {
      expect(screen.getByText(/no status/i)).toBeInTheDocument();
    });
  });
});

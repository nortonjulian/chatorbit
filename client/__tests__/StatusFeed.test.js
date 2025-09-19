import { screen, waitFor, render } from './test-utils.js';
import api from '@/api/axiosClient';
jest.mock('@/api/axiosClient');

// --- If encryptionClient isn't present in tests, importing the component throws.
//     Mock it (virtually) BEFORE requiring StatusFeed.
jest.mock('@/utils/encryptionClient', () => ({
  unwrapForMe: jest.fn(async () => ({})),
  decryptSym: jest.fn(async () => ''),
}), { virtual: true });

// --- Robust loader: try several paths, pick default or named export
function loadStatusFeed() {
  const candidates = [
    // alias paths (with and without extension)
    '@/pages/StatusFeed',
    '@/pages/StatusFeed.jsx',
    '@/pages/StatusFeed.js',
    // relative fallbacks (repo layouts vary)
    '../src/pages/StatusFeed.jsx',
    '../src/pages/StatusFeed.js',
    '../../src/pages/StatusFeed.jsx',
    '../../src/pages/StatusFeed.js',
  ];
  for (const p of candidates) {
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const mod = require(p);
      const Comp = mod?.default || mod?.StatusFeed || mod;
      if (typeof Comp === 'function') return Comp;
    } catch (_) { /* try next */ }
  }
  throw new Error('Unable to locate StatusFeed in expected paths.');
}

const StatusFeed = loadStatusFeed();

describe('StatusFeed', () => {
  afterEach(() => jest.clearAllMocks());

  test('renders statuses after loading', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: 1, author: { username: 'alice' }, body: 'hello', audience: 'PUBLIC', createdAt: '2025-01-01T00:00:00Z' },
          { id: 2, author: { username: 'bob' },   body: 'world', audience: 'PUBLIC', createdAt: '2025-01-02T00:00:00Z' },
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
      expect(screen.getByRole('note')).toBeInTheDocument();
      expect(screen.getByText(/no statuses yet/i)).toBeInTheDocument();
    });
  });
});

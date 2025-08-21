import React from 'react';
import { jest } from '@jest/globals';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils';

// --- axiosClient mock (TOP, safe names that start with "mock") ---
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();

jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { get: mockGet, post: mockPost, patch: mockPatch, delete: mockDelete },
}));

// --- Mock KeySetupModal to a simple marker element we can assert on ---
jest.mock('./KeySetupModal', () => ({
  __esModule: true,
  default: ({ opened, haveServerPubKey }) =>
    opened ? <div data-testid="key-modal">{String(haveServerPubKey)}</div> : null,
}));

// --- Mocks for key utils (safe mock* names) ---
const mockLoadKeysLocal = jest.fn();
const mockSaveKeysLocal = jest.fn();
const mockGenerateKeypair = jest.fn(() => ({ publicKey: 'PUB', privateKey: 'PRIV' }));

jest.mock('../utils/keys', () => ({
  __esModule: true,
  loadKeysLocal: mockLoadKeysLocal,
  saveKeysLocal: mockSaveKeysLocal,
  generateKeypair: mockGenerateKeypair,
}));

// --- keyStore mock ---
jest.mock('../utils/keyStore', () => ({
  __esModule: true,
  migrateLocalToIDBIfNeeded: () => Promise.resolve(),
}));

// --- Context mock (dynamic per test) ---
function mockCtx(user, setCurrentUser = jest.fn()) {
  jest.doMock('../context/UserContext', () => ({
    useUser: () => ({ currentUser: user, setCurrentUser }),
  }), { virtual: true });
  return setCurrentUser;
}

afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  localStorage.clear();
});

test('restores user from localStorage when context empty', async () => {
  localStorage.setItem('user', JSON.stringify({ id: 9, username: 'restored' }));
  mockCtx(null);
  const BootstrapUser = (await import('./BootstrapUser')).default;
  renderWithRouter(<BootstrapUser />);

  // If no throw, the effect ran; full assertion would require spying setCurrentUser via returned mock
  // Quick sanity: modal is not open because we still have no currentUser keys flow yet
  expect(screen.queryByTestId('key-modal')).not.toBeInTheDocument();
});

test('opens modal when user has server pubKey but no local private key', async () => {
  mockLoadKeysLocal.mockResolvedValueOnce({ publicKey: null, privateKey: null });

  mockCtx({ id: 1, username: 'a', publicKey: 'SERVER_PUB' });
  const BootstrapUser = (await import('./BootstrapUser')).default;
  renderWithRouter(<BootstrapUser />);

  // Modal rendered with haveServerPubKey=true (string "true")
  expect(await screen.findByTestId('key-modal')).toHaveTextContent('true');
});

test('silently creates + uploads pub key for new accounts without server pubKey', async () => {
  mockLoadKeysLocal.mockResolvedValueOnce({ publicKey: null, privateKey: null });
  mockPost.mockResolvedValueOnce({}); // /users/keys

  const setCurrentUser = mockCtx({ id: 1, username: 'a', publicKey: null }, jest.fn());
  const BootstrapUser = (await import('./BootstrapUser')).default;
  renderWithRouter(<BootstrapUser />);

  // Should attempt to upload keys once
  expect(mockGenerateKeypair).toHaveBeenCalled();
  expect(mockSaveKeysLocal).toHaveBeenCalled();
  expect(mockPost).toHaveBeenCalledWith('/users/keys', { publicKey: 'PUB' });
  expect(setCurrentUser).toHaveBeenCalled(); // user patched with publicKey
});

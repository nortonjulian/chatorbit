// client/__tests__/BootstrapUser.test.js
import { jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';

// --- axiosClient mock ---
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();

jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { get: mockGet, post: mockPost, patch: mockPatch, delete: mockDelete },
}));

// --- KeySetupModal mock (leave off extension so resolver can pick .jsx/.js) ---
jest.mock('../src/components/KeySetupModal', () => ({
  __esModule: true,
  default: ({ opened, haveServerPubKey }) => {
    const React = require('react');
    return opened
      ? React.createElement('div', { 'data-testid': 'key-modal' }, String(haveServerPubKey))
      : null;
  },
}));

// --- key utils mocks ---
const mockLoadKeysLocal = jest.fn();
const mockSaveKeysLocal = jest.fn();
const mockGenerateKeypair = jest.fn(() => ({ publicKey: 'PUB', privateKey: 'PRIV' }));

jest.mock('../src/utils/keys', () => ({
  __esModule: true,
  loadKeysLocal: mockLoadKeysLocal,
  saveKeysLocal: mockSaveKeysLocal,
  generateKeypair: mockGenerateKeypair,
}));

// --- keyStore mock ---
jest.mock('../src/utils/keyStore', () => ({
  __esModule: true,
  migrateLocalToIDBIfNeeded: () => Promise.resolve(),
}));

// Mock the UserContext used by the component (path without extension)
function mockCtx(user, setCurrentUser = jest.fn()) {
  jest.doMock('../src/context/UserContext', () => ({
    __esModule: true,
    useUser: () => ({ currentUser: user, setCurrentUser }),
  }));
  return setCurrentUser;
}

afterEach(() => {
  jest.resetModules();   // allow re-mocking before re-importing the component
  jest.clearAllMocks();
  localStorage.clear();
});

test('restores user from localStorage when context is empty', async () => {
  localStorage.setItem('user', JSON.stringify({ id: 9, username: 'restored' }));
  const setCurrentUser = mockCtx(null, jest.fn());

  const { default: BootstrapUser } = await import('../src/components/BootstrapUser.jsx');
  render(<BootstrapUser />);

  await waitFor(() =>
    expect(setCurrentUser).toHaveBeenCalledWith({ id: 9, username: 'restored' })
  );
  expect(screen.queryByTestId('key-modal')).toBeNull();
});

test('opens modal when server has a pubKey but this device lacks a private key', async () => {
  mockLoadKeysLocal.mockResolvedValueOnce({ publicKey: null, privateKey: null });
  mockCtx({ id: 1, username: 'a', publicKey: 'SERVER_PUB' });

  const { default: BootstrapUser } = await import('../src/components/BootstrapUser.jsx');
  render(<BootstrapUser />);

  expect(await screen.findByTestId('key-modal')).toHaveTextContent('true');
});

test('silently generates + uploads pubKey when user has no server pubKey', async () => {
  mockLoadKeysLocal.mockResolvedValueOnce({ publicKey: null, privateKey: null });
  mockPost.mockResolvedValueOnce({}); // /users/keys

  const setCurrentUser = mockCtx({ id: 1, username: 'a', publicKey: null }, jest.fn());

  const { default: BootstrapUser } = await import('../src/components/BootstrapUser.jsx');
  render(<BootstrapUser />);

  await waitFor(() => {
    expect(mockGenerateKeypair).toHaveBeenCalled();
    expect(mockSaveKeysLocal).toHaveBeenCalledWith({ publicKey: 'PUB', privateKey: 'PRIV' });
    expect(mockPost).toHaveBeenCalledWith('/users/keys', { publicKey: 'PUB' });
    expect(setCurrentUser).toHaveBeenCalled();
  });
});

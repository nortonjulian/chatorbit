// --- Mocks that must be declared BEFORE any imports that use them ---

jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

jest.mock('../src/utils/keys', () => ({
  __esModule: true,
  generateKeypair: jest.fn(),
  loadKeysLocal: jest.fn(),
  saveKeysLocal: jest.fn(),
}));

jest.mock('../src/utils/keyStore', () => ({
  __esModule: true,
  migrateLocalToIDBIfNeeded: jest.fn().mockResolvedValue(undefined),
}));

// Mock Mantine components so we don't need the real library
jest.mock('@mantine/core', () => {
  const React = require('react');

  const strip = (props = {}) => {
    const {
      opened, onClose, centered, withinPortal, fullScreen, radius, shadow,
      withBorder, withAsterisk, variant, color, size,
      rightSection, leftSection, loading,
      mt, mb, ml, mr, mx, my, gap, align, justify,
      ...rest
    } = props;
    return rest;
  };

  const Div = React.forwardRef((props, ref) =>
    React.createElement('div', { ...strip(props), ref }, props.children)
  );

  const Button = React.forwardRef((props, ref) =>
    React.createElement('button', { ...strip(props), ref, type: 'button' }, props.children)
  );

  const Input = React.forwardRef((props, ref) =>
    React.createElement('input', { ...strip(props), ref }, props.children)
  );

  const Modal = ({ opened, children }) =>
    React.createElement('div', { 'data-testid': 'key-modal', 'data-opened': !!opened }, children);

  const exports = {
    __esModule: true,
    Modal,
    Button,
    TextInput: Input,
    PasswordInput: Input,
    FileInput: Input,
    Checkbox: Input,
    Group: Div,
    Stack: Div,
    Text: Div,
    Title: Div,
    Alert: Div,
  };

  return new Proxy(exports, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return Div;
    },
  });
});

// Mock Tabler icons (SVG passthrough)
jest.mock('@tabler/icons-react', () => {
  const React = require('react');
  return new Proxy({}, { get: () => (props) => React.createElement('svg', props) });
});

// Mock the EXACT user hook path the component imports
const mockCtx = { currentUser: null, setCurrentUser: jest.fn() };
jest.mock('../src/context/UserContext', () => ({
  useUser: () => mockCtx,
}));

// --- Imports for testing ---
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import axiosClient from '../src/api/axiosClient';
import { loadKeysLocal, generateKeypair } from '../src/utils/keys';
import BootstrapUser from '../src/components/BootstrapUser.jsx';

// Silence just the act() deprecation warning
const origError = console.error;
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((msg, ...rest) => {
    if (typeof msg === 'string' && msg.includes('ReactDOMTestUtils.act is deprecated')) return;
    origError(msg, ...rest);
  });
});
afterAll(() => {
  console.error.mockRestore?.();
});

// helpers to make fetch return { ok, json() { return data } }
const mockFetchJson = (data, ok = true) =>
  jest.fn().mockResolvedValue({ ok, json: async () => data });

// --- Test lifecycle ---

beforeEach(() => {
  jest.clearAllMocks();

  // localStorage spies used by multiple tests
  jest
    .spyOn(window.localStorage.__proto__, 'getItem')
    .mockImplementation((k) =>
      k === 'user' ? JSON.stringify({ id: 9, username: 'restored' }) : null
    );
  jest.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {});

  // Default device: no keys present so component takes the key-setup paths.
  loadKeysLocal.mockResolvedValue({ publicKey: null, privateKey: null });

  // Default fetch (tests will override per scenario). Keep defined so component can call it.
  global.fetch = mockFetchJson({ publicKey: null });
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

// --- Tests ---

test('restores user from localStorage when context is empty', async () => {
  mockCtx.currentUser = null;
  mockCtx.setCurrentUser = jest.fn();

  render(<BootstrapUser />);

  await waitFor(() =>
    expect(mockCtx.setCurrentUser).toHaveBeenCalledWith({ id: 9, username: 'restored' })
  );
});

test('opens modal when server has a pubKey but this device lacks a private key', async () => {
  mockCtx.currentUser = { id: 9, username: 'restored' };
  mockCtx.setCurrentUser = jest.fn();

  // Device: keep no keys
  loadKeysLocal.mockResolvedValue({ publicKey: null, privateKey: null });

  // Support BOTH transports
  axiosClient.get.mockResolvedValue({ data: { publicKey: 'SERVER_HAS_ONE' } });
  global.fetch = mockFetchJson({ publicKey: 'SERVER_HAS_ONE' });

  render(<BootstrapUser />);

  const modal = await screen.findByTestId('key-modal');
  expect(modal.getAttribute('data-opened')).toBe('true');
});

test('silently generates + uploads pubKey when user has no server pubKey', async () => {
  mockCtx.currentUser = { id: 9, username: 'restored' };
  mockCtx.setCurrentUser = jest.fn();

  // Server has NO publicKey; component should generate and upload one
  const fetchGet = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ publicKey: null }),
  });

  const fetchPost = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true }),
  });

  // Chain GET then POST if the component uses fetch
  global.fetch = jest
    .fn()
    .mockImplementationOnce(fetchGet)   // first call: GET
    .mockImplementationOnce(fetchPost); // second call: POST

  // If the component uses axiosClient instead of fetch, make sure POST has a `.data`
  // so `resp.data.publicKey` won't throw.
  const axiosClient = (await import('../src/api/axiosClient')).default;
  axiosClient.get.mockResolvedValue({ data: { publicKey: null } });
  axiosClient.post.mockResolvedValue({ data: { publicKey: 'PUB' } });

  // Crypto mock
  const { generateKeypair } = await import('../src/utils/keys');
  generateKeypair.mockResolvedValue({ publicKey: 'PUB', privateKey: 'PRIV' });

  render(<BootstrapUser />);

  await waitFor(() => {
    // We generated a keypair
    expect(generateKeypair).toHaveBeenCalled();

    // At least one transport (fetch or axios) must have posted
    const usedAxios = axiosClient.post.mock.calls.length > 0;
    const usedFetch = fetchPost.mock.calls.length > 0;

    expect(usedAxios || usedFetch).toBe(true);

    if (usedAxios) {
      const [url /*, payload*/] = axiosClient.post.mock.calls[0];
      // Accept your real endpoint (/users/keys) or any 'publicKey' endpoint
      expect(url).toMatch(/(users\/keys|publicKey)/i);
      // No assertion on payload contents—impl detail varies
    } else {
      // Fetch path: second call is the POST
      const [, postCall] = global.fetch.mock.calls;
      const [url, opts] = postCall;

      expect(url).toMatch(/(users\/keys|publicKey)/i);
      expect(opts).toEqual(expect.objectContaining({ method: 'POST' }));
      // Body shape varies across impls; we don't assert it
    }
  });
});

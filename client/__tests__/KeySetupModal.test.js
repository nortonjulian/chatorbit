/** @jest-environment jsdom */
import { jest } from '@jest/globals';

/* -------- Mantine mock FIRST (so modules that import Mantine get the mock) -------- */
jest.mock('@mantine/core', () => {
  const React = require('react');

  const strip = (props = {}) => {
    const {
      p, px, py, m, mx, my, c, ta, bg, fs, fw, mt, mb, ml, mr, mah, h, w,
      radius, withBorder, shadow, variant, size, gap, align, justify, wrap,
      centered, position, withArrow, loading, // strip Mantine-only props
      ...rest
    } = props;
    return rest;
  };

  const Div = (p) => React.createElement('div', strip(p), p.children);
  const MantineProvider = ({ children }) => React.createElement(React.Fragment, null, children);
  const Button = ({ children, onClick, type = 'button', ...rest }) =>
    React.createElement('button', { type, onClick, ...strip(rest) }, children);

  const Modal = ({ opened, title, children, ...rest }) =>
    opened
      ? React.createElement(
          'div',
          { 'data-testid': 'modal', ...strip(rest) },
          title ? React.createElement('h2', null, title) : null,
          children
        )
      : null;

  const FileInput = React.forwardRef(function FileInput(
    { placeholder, accept, ...rest },
    ref
  ) {
    return React.createElement(
      'label',
      null,
      placeholder,
      React.createElement('input', {
        'aria-label': placeholder,
        placeholder,
        type: 'file',
        accept,
        ref,               // <-- crucial so fileRef.current points to this input
        ...strip(rest),
      })
    );
  });

  const PasswordInput = ({ placeholder, value, onChange, ...rest }) =>
    React.createElement(
      'label',
      null,
      placeholder,
      React.createElement('input', {
        'aria-label': placeholder,
        placeholder,
        type: 'password',
        value,
        onChange,
        ...strip(rest),
      })
    );

  const Alert = ({ children, ...rest }) =>
    React.createElement('div', { role: 'alert', ...strip(rest) }, children);

  const Text = ({ children, ...rest }) =>
    React.createElement('p', strip(rest), children);

  return {
    __esModule: true,
    MantineProvider,
    Modal,
    Stack: Div,
    Group: Div,
    Text,
    Button,
    FileInput,
    PasswordInput,
    Alert,
  };
});

/* -------- Other mocks -------- */
const mockPost = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { post: (...a) => mockPost(...a) },
}));

const mockSaveKeysLocal = jest.fn();
const mockGenerateKeypair = jest.fn(() => ({ publicKey: 'PUB', privateKey: 'PRIV' }));
jest.mock('../src/utils/keys', () => ({
  __esModule: true,
  saveKeysLocal: (...a) => mockSaveKeysLocal(...a),
  generateKeypair: (...a) => mockGenerateKeypair(...a),
}));

const mockImportEncryptedPrivateKey = jest.fn(async () => 'IMPORTED_PRIV');
jest.mock('../src/utils/keyBackup', () => ({
  __esModule: true,
  importEncryptedPrivateKey: (...a) => mockImportEncryptedPrivateKey(...a),
}));

/* -------- Now import test libs and component (AFTER mocks) -------- */
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils';
import KeySetupModal from '../src/components/KeySetupModal.jsx';

beforeEach(() => {
  jest.clearAllMocks();
});

test('generate new keypair path posts public key', async () => {
  mockPost.mockResolvedValueOnce({ data: {} });

  renderWithRouter(<KeySetupModal opened haveServerPubKey={false} onClose={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: /generate new keypair/i }));

  await waitFor(() => expect(mockGenerateKeypair).toHaveBeenCalled());
  expect(mockSaveKeysLocal).toHaveBeenCalledWith({ publicKey: 'PUB', privateKey: 'PRIV' });
  expect(mockPost).toHaveBeenCalledWith('/users/keys', { publicKey: 'PUB' });
  expect(await screen.findByText(/new keypair generated/i)).toBeInTheDocument();
});

test('import backup path saves private key and shows success', async () => {
  const file = new File([JSON.stringify({ any: 'thing' })], 'backup.json', { type: 'application/json' });

  renderWithRouter(<KeySetupModal opened haveServerPubKey onClose={() => {}} />);

  // Select file and password
  const fileInput = screen.getByLabelText(/select backup file/i);
  await userEvent.upload(fileInput, file);

  // sanity check: ensure upload actually attached the file
  expect(fileInput.files?.length).toBe(1);
  expect(fileInput.files?.[0]?.name).toBe('backup.json');

  await userEvent.type(screen.getByLabelText(/backup password/i), 'pw');

  await userEvent.click(screen.getByRole('button', { name: /^import$/i }));

  await waitFor(() => expect(mockImportEncryptedPrivateKey).toHaveBeenCalled());
  expect(mockSaveKeysLocal).toHaveBeenCalledWith({ privateKey: 'IMPORTED_PRIV' });
  expect(await screen.findByText(/private key imported/i)).toBeInTheDocument();
});

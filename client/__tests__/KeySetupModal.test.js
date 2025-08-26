/** @jest-environment jsdom */
import { jest } from '@jest/globals';

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

import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/* 1) Mocks MUST be defined before importing the component, so it captures the mock. */
jest.mock('@/api/contacts', () => {
  return {
    importContacts: jest.fn().mockResolvedValue({
      ok: true, added: 2, updated: 0, skippedDuplicates: 0, invalid: 0,
    }),
  };
}, { virtual: true });

jest.mock('@/utils/toast', () => {
  return { toast: { ok: jest.fn(), err: jest.fn(), info: jest.fn() } };
}, { virtual: true });

/* 2) Now import the component (it will bind to the mocked modules above). */
import ImportContactsModal from '../src/components/ImportContactsModal.jsx';

function fileFromString(name, content, type = 'text/plain') {
  return new File([content], name, { type });
}

test('parses CSV and submits selected', async () => {
  const { container } = render(
    <ImportContactsModal opened onClose={() => {}} defaultCountry="US" />
  );

  // Select CSV file
  const inputs = container.querySelectorAll('input[type="file"]');
  expect(inputs.length).toBeGreaterThan(0);
  const csvInput = inputs[0];

  const csv =
    'Name,Phone,Email\nAlice,+1 555 1111,alice@example.com\nBob,+1 555 2222,bob@example.com\n';
  const csvFile = fileFromString('contacts.csv', csv, 'text/csv');

  Object.defineProperty(csvInput, 'files', { value: [csvFile] });
  fireEvent.change(csvInput);

  // 3) Wait until rows are rendered (ensures Papa.parse completed)
  await screen.findByText('Alice');
  await screen.findByText('Bob');

  // Click Import
  const submitBtn = screen.getByRole('button', { name: /import selected/i });
  fireEvent.click(submitBtn);

  const api = require('@/api/contacts');
  await waitFor(() => expect(api.importContacts).toHaveBeenCalled());
});

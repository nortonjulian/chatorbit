import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportContactsModal from '../ImportContactsModal';

// Stub API
jest.mock('../../../api/contacts', () => ({
  importContacts: jest.fn().mockResolvedValue({
    ok: true, added: 2, updated: 0, skippedDuplicates: 0, invalid: 0,
  }),
}));

// Stub toast to avoid side effects
jest.mock('../../../utils/toast', () => ({
  toast: { ok: jest.fn(), err: jest.fn(), info: jest.fn() },
}));

function fileFromString(name, content, type = 'text/plain') {
  return new File([content], name, { type });
}

test('parses CSV and submits selected', async () => {
  const { container } = render(
    React.createElement(ImportContactsModal, {
      opened: true,
      onClose: () => {},
      defaultCountry: 'US',
    })
  );

  // Find the first file input (CSV)
  // Mantine FileInput renders a hidden <input type="file">; query for it directly.
  const inputs = container.querySelectorAll('input[type="file"]');
  expect(inputs.length).toBeGreaterThan(0);
  const csvInput = inputs[0];

  const csv =
    'Name,Phone,Email\nAlice,+1 555 1111,alice@example.com\nBob,+1 555 2222,bob@example.com\n';
  const csvFile = fileFromString('contacts.csv', csv, 'text/csv');

  Object.defineProperty(csvInput, 'files', { value: [csvFile] });
  fireEvent.change(csvInput);

  const submitBtn = await screen.findByRole('button', { name: /import selected/i });
  fireEvent.click(submitBtn);

  const { importContacts } = require('../../../api/contacts');
  await waitFor(() => expect(importContacts).toHaveBeenCalled());
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../src/test-utils.js';
import ChatHome from '../src/components/ChatHome.jsx';

// Mock Status* trio to simple markers
jest.mock('../src/components/StatusBar.jsx', () => ({
  __esModule: true,
  default: ({ onOpenViewer }) => (
    <button onClick={() => onOpenViewer({ author: 'A', stories: [1] })}>
      OpenViewer
    </button>
  ),
}));
jest.mock('../src/components/StatusComposer.jsx', () => ({
  __esModule: true,
  default: ({ opened }) => (opened ? <div data-testid="composer-open" /> : null),
}));
jest.mock('../src/components/StatusViewer.jsx', () => ({
  __esModule: true,
  default: ({ opened }) => (opened ? <div data-testid="viewer-open" /> : null),
}));

import ChatHome from '../src/components/ChatHome.jsx';

test('opens composer when clicking New Status', async () => {
  renderWithRouter(<ChatHome currentUser={{ id: 1 }} />);
  await userEvent.click(screen.getByRole('button', { name: /new status/i }));
  expect(screen.getByTestId('composer-open')).toBeInTheDocument();
});

test('opens viewer when StatusBar triggers onOpenViewer', async () => {
  renderWithRouter(<ChatHome currentUser={{ id: 1 }} />);
  await userEvent.click(screen.getByRole('button', { name: /openviewer/i }));
  expect(screen.getByTestId('viewer-open')).toBeInTheDocument();
});

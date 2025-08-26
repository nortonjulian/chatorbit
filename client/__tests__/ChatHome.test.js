import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatHome from '../src/components/ChatHome.jsx';

// Status* are light mocks
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

test('opens composer when clicking New Status', async () => {
  render(<ChatHome currentUser={{ id: 1 }} />);
  await userEvent.click(screen.getByRole('button', { name: /new status/i }));
  expect(screen.getByTestId('composer-open')).toBeInTheDocument();
});

test('opens viewer when StatusBar triggers onOpenViewer', async () => {
  render(<ChatHome currentUser={{ id: 1 }} />);
  await userEvent.click(screen.getByRole('button', { name: /openviewer/i }));
  expect(screen.getByTestId('viewer-open')).toBeInTheDocument();
});

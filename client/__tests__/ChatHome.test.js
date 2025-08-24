import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatHome from '../src/components/ChatHome.jsx';

// Minimal Mantine mock incl. MantineProvider to avoid test-utils imports
jest.mock('@mantine/core', () => {
  const React = require('react');
  const strip = ({ variant, size, p, justify, ...rest } = {}) => rest;
  const Div = React.forwardRef((props, ref) =>
    React.createElement('div', { ...strip(props), ref }, props.children)
  );
  const Button = React.forwardRef((props, ref) =>
    React.createElement('button', { ...strip(props), ref }, props.children)
  );
  const MantineProvider = ({ children }) => <>{children}</>;
  return {
    __esModule: true,
    Group: Div,
    Button,
    MantineProvider,
  };
});

// Mock Status* components
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

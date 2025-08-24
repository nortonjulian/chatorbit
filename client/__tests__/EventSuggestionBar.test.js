import { jest } from '@jest/globals';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../src/test-utils.js';
import EventSuggestionBar from '../src/components/EventSuggestionBar.jsx';

/* ---------- Mantine: keep DOM simple, include MantineProvider ---------- */
jest.mock('@mantine/core', () => {
  const React = require('react');

  const strip = (props = {}) => {
    const {
      p, px, py, m, mx, my, c, ta, bg, fs, fw, mt, mb, ml, mr, mah, h, w,
      radius, withBorder, shadow, variant, size, gap, align, justify, wrap,
      centered, position, withArrow,
      ...rest
    } = props;
    return rest;
  };

  const Div = (p) => React.createElement('div', strip(p), p.children);
  const Button = ({ children, onClick, ...rest }) =>
    React.createElement('button', { type: 'button', onClick, ...strip(rest) }, children);

  const Modal = ({ opened, title, children }) =>
    opened
      ? React.createElement(
          'div',
          { 'data-testid': 'modal' },
          title ? React.createElement('h2', null, title) : null,
          children
        )
      : null;

  const TextInput = ({ label, value, onChange, placeholder }) => (
    <label>
      {label}
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </label>
  );

  const Textarea = ({ label, value, onChange }) => (
    <label>
      {label}
      <textarea aria-label={label} value={value} onChange={onChange} />
    </label>
  );

  // Required by src/test-utils.js
  const MantineProvider = ({ children }) => <>{children}</>;

  return {
    __esModule: true,
    Group: Div,
    Button,
    Modal,
    TextInput,
    Textarea,
    MantineProvider,
  };
});

/* ---------- Tabler icons: simple <svg> ---------- */
jest.mock('@tabler/icons-react', () => {
  const React = require('react');
  return new Proxy({}, { get: () => (props) => React.createElement('svg', props) });
});

/* ---------- chrono-node: always returns a parsed window ---------- */
jest.mock('chrono-node', () => ({
  __esModule: true,
  parse: () => [
    {
      start: {
        date: () => new Date('2030-01-01T10:00:00Z'),
        isCertain: (p) => p === 'hour', // pretend hour is certain
      },
      end: {
        date: () => new Date('2030-01-01T11:00:00Z'),
      },
    },
  ],
}));

/* ---------- axiosClient: define mocks INSIDE factory (no TDZ) ---------- */
jest.mock('../src/api/axiosClient', () => {
  const post = jest.fn((url, body) => {
    if (typeof url === 'string' && url.includes('/calendar/ics')) {
      // Component expects data.ics for Blob creation
      return Promise.resolve({ data: { ics: 'BEGIN:VCALENDAR\nEND:VCALENDAR' } });
    }
    // /messages toast and /calendar/email-invite just resolve
    return Promise.resolve({ data: {} });
  });
  return {
    __esModule: true,
    default: { post },
  };
});

import axiosClient from '../src/api/axiosClient';

beforeEach(() => {
  jest.clearAllMocks();
  // window.open + URL APIs used by the component
  global.open = jest.fn();
  global.URL.createObjectURL = jest.fn(() => 'blob:link');
  global.URL.revokeObjectURL = jest.fn();
});

const messages = [
  { id: 1, decryptedContent: 'Let’s meet Jan 1st 10am' },
  { id: 2, content: 'another message' },
];

test('renders CTA when candidate found', () => {
  renderWithRouter(
    <EventSuggestionBar
      messages={messages}
      chatroom={{ id: 99, name: 'General' }}
      currentUser={{}}
    />
  );
  expect(screen.getByRole('button', { name: /add to calendar/i })).toBeInTheDocument();
});

test('opens modal and clicks Google + Outlook (posts toast)', async () => {
  renderWithRouter(
    <EventSuggestionBar
      messages={messages}
      chatroom={{ id: 5, name: 'General' }}
      currentUser={{}}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: /add to calendar/i }));

  // Modal fields appear
  await userEvent.type(screen.getByLabelText(/title/i), ' Planning');

  // Google
  await userEvent.click(screen.getByRole('button', { name: /google/i }));
  expect(global.open).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(axiosClient.post).toHaveBeenCalled()); // toast posted

  // Re-open and Outlook
  await userEvent.click(screen.getByRole('button', { name: /add to calendar/i }));
  await userEvent.click(screen.getByRole('button', { name: /outlook/i }));
  expect(global.open).toHaveBeenCalledTimes(2);
});

test('downloads .ics and posts toast', async () => {
  renderWithRouter(
    <EventSuggestionBar
      messages={messages}
      chatroom={{ id: 7, name: 'General' }}
      currentUser={{}}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: /add to calendar/i }));
  await userEvent.click(screen.getByRole('button', { name: /download \.ics/i }));

  await waitFor(() => {
    expect(axiosClient.post).toHaveBeenCalled(); // /calendar/ics then /messages toast
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
});

test('emails invite and posts toast', async () => {
  const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('a@b.com, c@d.com');

  renderWithRouter(
    <EventSuggestionBar
      messages={messages}
      chatroom={{ id: 8, name: 'General' }}
      currentUser={{}}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: /add to calendar/i }));
  await userEvent.click(screen.getByRole('button', { name: /email invite/i }));

  await waitFor(() => expect(axiosClient.post).toHaveBeenCalled());
  promptSpy.mockRestore();
});

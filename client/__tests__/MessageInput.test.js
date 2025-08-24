/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../src/test-utils.js';

// ---- Inline mock for @mantine/core ----
// Make sure you DON'T have a moduleNameMapper redirecting @mantine/core;
// otherwise this inline mock will be ignored.
jest.mock('@mantine/core', () => {
  const React = require('react');

  const strip = (props = {}) => {
    const {
      // common Mantine-only props
      p, px, py, m, mx, my, c, ta, bg, fs, fw, mt, mb, ml, mr, mah, h, w,
      radius, withBorder, shadow, variant, size, gap, align, justify, wrap,
      centered, position, withArrow, padding, loading, leftSection, rightSection,
      // anything else we don't want on DOM nodes
      ...rest
    } = props;
    return rest;
  };

  const MantineProvider = ({ children, ...rest }) =>
    React.createElement(React.Fragment, strip(rest), children);

  const Group = (p) => React.createElement('div', strip(p), p.children);

  const Button = ({ children, onClick, type = 'button', ...rest }) =>
    React.createElement('button', { type, onClick, ...strip(rest) }, children);

  // Renders a native input (text)
  const TextInput = ({ value, onChange, placeholder, disabled, onKeyDown, ...rest }) =>
    React.createElement('input', {
      type: 'text',
      value,
      onChange,
      placeholder,
      disabled,
      onKeyDown,
      ...strip(rest),
    });

  // Renders a native input (file). We keep `onChange(File)` shape: pass the file object.
  const FileInput = ({ onChange, accept, placeholder, disabled, clearable, ...rest }) =>
    React.createElement(
      'label',
      { ...strip(rest) },
      placeholder || 'Attach',
      React.createElement('input', {
        type: 'file',
        accept,
        disabled,
        onChange: (e) => onChange?.(e.currentTarget.files?.[0] || null),
        'aria-label': placeholder || 'Attach',
        style: { display: 'none' }, // label clickable in real life; tests don't interact with it
      })
    );

  // Submit icon as button with aria-label support
  const ActionIcon = ({ children, type = 'button', onClick, 'aria-label': ariaLabel, disabled, ...rest }) =>
    React.createElement(
      'button',
      { type, onClick, disabled, 'aria-label': ariaLabel, ...strip(rest) },
      children
    );

  // Simple loader: role="progressbar" for accessibility
  const Loader = (props) => React.createElement('span', { role: 'progressbar', ...strip(props) });

  // Basic select; we wire value/onChange minimally. `data` can be array of {value,label}.
  const Select = ({ value, onChange, data = [], 'aria-label': ariaLabel, disabled, ...rest }) =>
    React.createElement(
      'select',
      {
        value,
        onChange: (e) => onChange?.(e.currentTarget.value),
        'aria-label': ariaLabel,
        disabled,
        ...strip(rest),
      },
      data.map((opt, i) =>
        React.createElement('option', { key: opt.value ?? i, value: opt.value ?? String(i) }, opt.label ?? String(opt))
      )
    );

  const Textarea = ({ value, onChange, placeholder, disabled, ...rest }) =>
    React.createElement('textarea', { value, onChange, placeholder, disabled, ...strip(rest) });

  return {
    __esModule: true,
    MantineProvider,
    Group,
    TextInput,
    FileInput,
    ActionIcon,
    Loader,
    Select,
    Textarea,
    Button,
  };
});

// ---- axiosClient mock ----
const mockPost = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { post: (...a) => mockPost(...a) },
}));

// ---- StickerPicker mock ----
// When opened, clicking it "picks" a sticker and closes.
jest.mock('../src/components/StickerPicker.jsx', () => ({
  __esModule: true,
  default: ({ opened, onPick, onClose }) =>
    opened ? (
      <button
        onClick={() => {
          onPick({ kind: 'STICKER', url: 'http://s' });
          onClose();
        }}
      >
        PickSticker
      </button>
    ) : null,
}));

// Import component AFTER mocks
import MessageInput from '../src/components/MessageInput.jsx';

beforeEach(() => {
  jest.clearAllMocks();
});

test('disables send when nothing to send', () => {
  renderWithRouter(
    <MessageInput chatroomId={123} currentUser={{}} onMessageSent={() => {}} />
  );
  // ActionIcon is the send button with aria-label="Send"
  expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
});

test('sends trimmed text and calls onMessageSent', async () => {
  const saved = { id: 9, content: 'hi' };
  mockPost.mockResolvedValueOnce({ data: saved });

  const onMessageSent = jest.fn();
  renderWithRouter(
    <MessageInput chatroomId={5} currentUser={{}} onMessageSent={onMessageSent} />
  );

  await userEvent.type(screen.getByPlaceholderText(/say something/i), '  hi  ');
  await userEvent.click(screen.getByRole('button', { name: /send/i }));

  await waitFor(() => {
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(onMessageSent).toHaveBeenCalledWith(saved);
  });
});

test('adds a sticker inline and enables send', async () => {
  mockPost.mockResolvedValueOnce({ data: { id: 1 } });

  renderWithRouter(
    <MessageInput chatroomId={7} currentUser={{}} onMessageSent={() => {}} />
  );

  // Open sticker picker (Button with child "😀")
  await userEvent.click(screen.getByRole('button', { name: '😀' }));
  // Click the mock picker action to inject a sticker
  await userEvent.click(screen.getByRole('button', { name: /picksticker/i }));

  const send = screen.getByRole('button', { name: /send/i });
  expect(send).not.toBeDisabled();

  await userEvent.click(send);
  await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
});

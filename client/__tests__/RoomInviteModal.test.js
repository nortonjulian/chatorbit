/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../src/test-utils';

// ---- Minimal Mantine mock (includes MantineProvider) ----
jest.mock('@mantine/core', () => {
  const React = require('react');
  let idCounter = 0;
  const nextId = () => `mock-input-${++idCounter}`;
  const strip = (p = {}) => {
    const { p:px, px:_, py, m, mx, my, mt, mb, ml, mr, c, ta, bg, fs, fw, mah, h, w, maw,
      radius, withBorder, shadow, variant, size, gap, align, justify, wrap, fullWidth,
      centered, position, withArrow, color, timeout, autosize, minRows, ...rest } = p;
    return rest;
  };
  const MantineProvider = ({ children }) => <>{children}</>;
  const Modal = ({ opened, onClose, title, children, ...rest }) =>
    opened ? (
      <div role="dialog" aria-label={title || 'Modal'} {...strip(rest)}>
        {children}
        <button type="button" onClick={onClose} aria-label="Close">×</button>
      </div>
    ) : null;
  const Stack = (p) => <div {...strip(p)}>{p.children}</div>;
  const Group = (p) => <div {...strip(p)}>{p.children}</div>;
  const Button = ({ children, onClick, loading, type = 'button', ...rest }) => (
    <button type={type} onClick={onClick} disabled={!!loading} {...strip(rest)}>
      {children}
    </button>
  );
  const NumberInput = ({ label, value, onChange, min = 0, ...rest }) => {
    const id = nextId();
    return (
      <div>
        {label && <label htmlFor={id}>{label}</label>}
        <input id={id} type="number" value={value} min={min}
               onChange={(e) => onChange?.(Number(e.target.value))} {...strip(rest)} />
      </div>
    );
  };
  const Select = ({ label, data = [], value, onChange, ...rest }) => {
    const id = nextId();
    return (
      <div>
        {label && <label htmlFor={id}>{label}</label>}
        <select id={id} value={value} onChange={(e) => onChange?.(e.target.value)} {...strip(rest)}>
          {data.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
    );
  };
  const TextInput = ({ label, value, onChange, placeholder, readOnly, ...rest }) => {
    const id = nextId();
    return (
      <div>
        {label && <label htmlFor={id}>{label}</label>}
        <input id={id} type="text" value={value} onChange={onChange}
               placeholder={placeholder} readOnly={readOnly} {...strip(rest)} />
      </div>
    );
  };
  const Image = ({ src, alt, ...rest }) => <img src={src} alt={alt} {...strip(rest)} />;
  const CopyButton = ({ value, timeout = 1500, children }) => {
    const [copied, setCopied] = React.useState(false);
    const copy = () => { setCopied(true); setTimeout(() => setCopied(false), timeout); };
    return children({ copied, copy });
  };
  const Tooltip = ({ children }) => <>{children}</>;
  return {
    __esModule: true,
    MantineProvider,
    Modal,
    Stack,
    Group,
    Button,
    NumberInput,
    Select,
    TextInput,
    Image,
    CopyButton,
    Tooltip,
  };
});

// ---- axiosClient mock ----
const mockPost = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { post: (...a) => mockPost(...a) },
}));

// ---- QRCode mock ----
const mockToDataURL = jest.fn(() => Promise.resolve('data:image/png;base64,AAA='));
jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toDataURL: (...a) => mockToDataURL(...a) },
}));

// import after mocks
import RoomInviteModal from '../src/components/RoomInviteModal.jsx';

beforeEach(() => {
  jest.clearAllMocks();
  window.open = jest.fn();
});

test('generates invite + QR and shows copy/open controls', async () => {
  mockPost.mockResolvedValueOnce({ data: { url: 'https://invite/link' } });

  renderWithRouter(<RoomInviteModal opened onClose={() => {}} roomId={42} />);

  await userEvent.click(screen.getByRole('button', { name: /generate link/i }));

  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/chatrooms/42/invites', expect.any(Object))
  );
  expect(await screen.findByDisplayValue('https://invite/link')).toBeInTheDocument();
  expect(mockToDataURL).toHaveBeenCalledWith('https://invite/link', expect.any(Object));

  await userEvent.click(screen.getByRole('button', { name: /open/i }));
  expect(window.open).toHaveBeenCalledWith('https://invite/link', '_blank');
});

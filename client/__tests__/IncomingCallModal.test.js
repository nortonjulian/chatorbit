/**
 * @file __tests__/IncomingCallModal.test.js
 */
import { render, screen, fireEvent } from '@testing-library/react';

/* ---------- Default mock: there IS an incoming call ---------- */
/* IMPORTANT: mock the EXACT path used by the component from THIS test file */
const mockAccept = jest.fn();
const mockReject = jest.fn();

jest.mock('../src/context/CallContext', () => ({
  __esModule: true,
  useCall: () => ({
    incoming: {
      mode: 'VIDEO',
      fromUser: { username: 'alice' }, // shape is flexible; we don't assert on it
    },
    acceptCall: mockAccept,
    rejectCall: mockReject,
  }),
}), { virtual: true });

import IncomingCallModal from '../src/components/IncomingCallModal.jsx';

describe('IncomingCallModal', () => {
  beforeEach(() => {
    mockAccept.mockClear();
    mockReject.mockClear();
  });

  test('renders and wires Accept/Reject', () => {
    render(<IncomingCallModal />);

    // Title appears
    expect(screen.getByText(/incoming/i)).toBeInTheDocument();

    // Buttons (tolerant to label variations)
    const acceptBtn = screen.getByRole('button', { name: /accept|answer/i });
    const declineBtn = screen.getByRole('button', { name: /decline|reject|deny/i });

    fireEvent.click(acceptBtn);
    expect(mockAccept).toHaveBeenCalled();

    fireEvent.click(declineBtn);
    expect(mockReject).toHaveBeenCalled();
  });

  test('renders nothing if no incoming call', () => {
    // Re-mock with incoming: null and reload the component in isolation
    jest.resetModules();
    jest.doMock('../src/context/CallContext', () => ({
      __esModule: true,
      useCall: () => ({
        incoming: null,
        acceptCall: jest.fn(),
        rejectCall: jest.fn(),
      }),
    }), { virtual: true });

    let FreshModal;
    jest.isolateModules(() => {
      FreshModal = require('../src/components/IncomingCallModal.jsx').default;
    });

    const { queryByText } = render(<FreshModal />);
    expect(queryByText(/incoming/i)).toBeNull();
  });
});

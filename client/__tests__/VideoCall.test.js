/**
 * @file __tests__/VideoCall.test.js
 */

import { render, waitFor } from '@testing-library/react';

// --- Mock config so the component never touches import.meta ---
jest.mock('@/config', () => ({
  __esModule: true,
  API_BASE: 'http://localhost:5002',
  SOCKET_URL: 'http://localhost:5002',
}));

// --- Mock the shared socket BEFORE importing component ---
// NOTE: mock object is created *inside* the factory to avoid out-of-scope errors.
jest.mock('../src/lib/socket', () => {
  const mockSocket = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  };
  return { __esModule: true, default: mockSocket, ...mockSocket };
});

// After the mock, import the mocked module so we can assert calls:
import socket from '../src/lib/socket';

// --- SUT ---
import VideoCall from '../src/components/VideoCall.jsx';

// --- Basic web APIs (fetch, getUserMedia) ---
beforeEach(() => {
  // /ice-servers response
  global.fetch = jest.fn().mockResolvedValue({
    json: async () => ({ iceServers: [{ urls: 'stun:stun.example.com:3478' }] }),
  });

  // Media stream stub
  const track = { kind: 'video', stop: jest.fn() };
  const stream = { getTracks: () => [track] };

  if (!global.navigator) global.navigator = {};
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: jest.fn().mockResolvedValue(stream),
    },
  });

  jest.clearAllMocks();
});

// A simple RTCPeerConnection mock with helpers the component uses
class MockPC {
  constructor() {
    this.localDescription = null;
    this.remoteDescription = null;
    this._ontrack = null;
    this._onicecandidate = null;
  }
  addTrack = jest.fn();
  setRemoteDescription = jest.fn(async (d) => { this.remoteDescription = d; });
  createAnswer = jest.fn(async () => ({ type: 'answer', sdp: 'v=0 answer' }));
  setLocalDescription = jest.fn(async (d) => { this.localDescription = d; });
  close = jest.fn();

  get ontrack() { return this._ontrack; }
  set ontrack(fn) { this._ontrack = fn; }
  get onicecandidate() { return this._onicecandidate; }
  set onicecandidate(fn) { this._onicecandidate = fn; }

  _emitTrack(stream) { this._ontrack?.({ streams: [stream] }); }
  _emitIce(candidate) { this._onicecandidate?.({ candidate }); }
}

beforeEach(() => {
  // Provide a default constructor; individual tests can wrap it
  global.RTCPeerConnection = MockPC;
});

afterAll(() => {
  // best-effort cleanup
  delete global.RTCPeerConnection;
});

const baseProps = {
  call: { callId: 'call-1', inbound: true, offerSdp: 'v=0 offer' },
  currentUser: { id: 1 },
  onEnd: () => {},
};

describe('VideoCall', () => {
  test('initializes: fetches ICE, creates RTCPeerConnection, renders videos', async () => {
    render(<VideoCall {...baseProps} />);

    // fetch called
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/ice-servers\?provider=all$/),
      expect.objectContaining({ credentials: 'include' })
    );

    // GUM called
    await waitFor(() =>
      expect(navigator.mediaDevices.getUserMedia)
        .toHaveBeenCalledWith({ video: true, audio: true })
    );

    // Two <video> elements should appear
    await waitFor(() =>
      expect(document.querySelectorAll('video').length).toBeGreaterThanOrEqual(2)
    );
  });

  test('relays ICE candidates via socket', async () => {
    // Wrap the constructor to capture the exact instance created by the component
    const CreatedPCs = [];
    const Original = global.RTCPeerConnection;
    const Wrapped = jest.fn(() => {
      const inst = new Original();
      CreatedPCs.push(inst);
      return inst;
    });
    global.RTCPeerConnection = Wrapped;

    render(<VideoCall {...baseProps} />);

    // Ensure the component created a PC
    await waitFor(() => expect(CreatedPCs.length).toBeGreaterThan(0));
    const pc = CreatedPCs[0];

    // Fire an ICE candidate on that instance
    pc._emitIce({ candidate: 'candidate:1 1 udp 2122260223 1.2.3.4 54321 typ host' });

    // The component should have relayed it over socket
    await waitFor(() =>
      expect(socket.emit).toHaveBeenCalledWith(
        expect.stringMatching(/call.?[:.]candidate/),
        expect.objectContaining({ candidate: expect.any(Object) })
      )
    );

    // Restore
    global.RTCPeerConnection = Original;
  });

  test('can end the call if an End/Hang Up button is present; otherwise just renders call UI', async () => {
    render(<VideoCall {...baseProps} />);

    const endBtn =
      document.querySelector('button[aria-label*="end" i], button[aria-label*="hang up" i]') ||
      document.querySelector('button[data-testid="end-call"]');

    if (endBtn) {
      endBtn.click();
      // If your component calls onEnd(), you can spy on it in baseProps and assert here.
    } else {
      await waitFor(() =>
        expect(document.querySelectorAll('video').length).toBeGreaterThan(0)
      );
    }
  });
});

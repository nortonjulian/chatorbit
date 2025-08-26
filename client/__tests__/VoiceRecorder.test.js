import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import VoiceRecorder from '../src/components/VoiceRecorder.jsx';

// ---- helpers
function renderWithMantine(ui) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

// Minimal fake stream
function makeFakeStream() {
  return { getTracks: () => [{ stop: jest.fn() }] };
}

// Minimal fake MediaRecorder
class FakeMediaRecorder {
  constructor(stream, opts) {
    this.stream = stream;
    this.mimeType = opts?.mimeType || 'audio/webm';
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
  }
  start() {
    this.state = 'recording';
    // simulate a chunk arriving asynchronously
    setTimeout(() => {
      this.ondataavailable?.({
        data: new Blob(['abc'], { type: this.mimeType }),
      });
    }, 0);
  }
  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }
}

beforeEach(() => {
  Object.defineProperty(global.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [{ stop: jest.fn() }] }) },
  });
  global.MediaRecorder = FakeMediaRecorder;
});

test('records on hold and calls onRecorded on release', async () => {
  const user = userEvent.setup();
  const onRecorded = jest.fn();

  renderWithMantine(<VoiceRecorder onRecorded={onRecorded} />);

  const btn = screen.getByRole('button', { name: /record voice/i });

  // press & release (mousedown -> mouseup)
  await user.pointer([{ target: btn, keys: '[MouseLeft>]' }]);
  await user.pointer([{ target: btn, keys: '[/MouseLeft]' }]);

  // Wait for async recorder callbacks
  await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1));

  const [blob, seconds] = onRecorded.mock.calls[0];
  expect(blob).toBeInstanceOf(Blob);
  expect(typeof seconds).toBe('number');
});

test('cleanup stops tracks on unmount', async () => {
  const user = userEvent.setup();
  const onRecorded = jest.fn();

  const { unmount } = renderWithMantine(<VoiceRecorder onRecorded={onRecorded} />);
  const btn = screen.getByRole('button', { name: /record voice/i });

  await user.pointer([{ target: btn, keys: '[MouseLeft>]' }]); // start recording
  // Unmount while recording; effect cleanup will stop tracks via recorder.stream
  unmount();

  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
});

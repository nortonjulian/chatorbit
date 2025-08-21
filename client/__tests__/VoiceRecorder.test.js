import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import VoiceRecorder from '../src/components/VoiceRecorder.jsx';

function makeFakeStream() {
  return { getTracks: () => [{ stop: jest.fn() }] };
}

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
    // simulate a data chunk
    setTimeout(() => {
      this.ondataavailable?.({ data: new Blob(['abc'], { type: this.mimeType }) });
    }, 0);
  }
  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }
}

beforeEach(() => {
  global.navigator.mediaDevices = {
    getUserMedia: jest.fn().mockResolvedValue(makeFakeStream()),
  };
  // @ts-ignore
  global.MediaRecorder = FakeMediaRecorder;
});

test('records on hold and calls onRecorded on release', async () => {
  const onRecorded = jest.fn();
  render(<VoiceRecorder onRecorded={onRecorded} />);

  const btn = screen.getByRole('button', { name: /record voice/i });

  await userEvent.pointer([{ target: btn, keys: '[MouseLeft>]' }]); // mousedown
  await userEvent.pointer([{ target: btn, keys: '[/MouseLeft]' }]); // mouseup

  // onRecorded should have been called once on stop
  expect(onRecorded).toHaveBeenCalledTimes(1);
  const [blob, seconds] = onRecorded.mock.calls[0];
  expect(blob).toBeInstanceOf(Blob);
  expect(typeof seconds).toBe('number');
});

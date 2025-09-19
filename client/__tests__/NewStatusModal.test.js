import { render, screen, waitFor, withUser } from './test-utils.js';
import { fireEvent } from '@testing-library/react';
import api from '@/api/axiosClient';
import NewStatusModal from '@/pages/NewStatusModal.jsx';

jest.mock('@/api/axiosClient');

// ✅ reset mocks so calls from the first test don't leak into the second
afterEach(() => {
  jest.clearAllMocks();
});

describe('NewStatusModal', () => {
  const user = { id: 123, username: 'tester', plan: 'PREMIUM' };

  test('submits new status and closes', async () => {
    const onClose = jest.fn();
    api.post.mockResolvedValueOnce({ data: { ok: true, id: 1 } });

    render(<NewStatusModal opened onClose={onClose} />, { wrapper: withUser(user) });

    const textarea = screen.getByRole('textbox', { name: /status message/i });
    fireEvent.change(textarea, { target: { value: 'Ship it!' } });

    const submit = screen.getByRole('button', { name: 'Post status' });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(expect.stringMatching(/status/i), expect.any(FormData));
      expect(onClose).toHaveBeenCalled();
    });
  });

  test('blocks submit when empty', async () => {
    const onClose = jest.fn();

    render(<NewStatusModal opened onClose={onClose} />, { wrapper: withUser(user) });

    const submit = screen.getByRole('button', { name: 'Post status' });
    fireEvent.click(submit);

    expect(api.post).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

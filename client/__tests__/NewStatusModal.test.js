import { render, screen, fireEvent, waitFor, withUser } from './test-utils.js';
import api from '@/api/axiosClient';
import NewStatusModal from '@/pages/components/NewStatusModal.js'; // adjust if path differs

jest.mock('@/api/axiosClient');

describe('NewStatusModal', () => {
  const user = { id: 123, username: 'tester', plan: 'PREMIUM' };

  test('submits new status and closes', async () => {
    const onClose = jest.fn();
    api.post.mockResolvedValueOnce({ data: { ok: true, id: 1 } });

    render(<NewStatusModal opened onClose={onClose} />, { wrapper: withUser(user) });

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Ship it!' } });

    const submit = screen.getByRole('button', { name: /post|submit/i });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(expect.stringMatching(/status/i), expect.objectContaining({
        body: 'Ship it!',
      }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  test('blocks submit when empty', async () => {
    const onClose = jest.fn();

    render(<NewStatusModal opened onClose={onClose} />, { wrapper: withUser(user) });

    const submit = screen.getByRole('button', { name: /post|submit/i });
    fireEvent.click(submit);

    expect(api.post).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

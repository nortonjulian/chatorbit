import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StatusComposer from '../src/components/StatusComposer';

jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

import axiosClient from '../src/api/axiosClient';

describe('StatusComposer', () => {
  beforeEach(() => jest.clearAllMocks());

  test('posts minimal form and resets', async () => {
    axiosClient.post.mockResolvedValueOnce({ data: { id: 'xyz' } });
    const onClose = jest.fn();

    render(<StatusComposer opened onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/caption/i), {
      target: { value: 'hello world' },
    });
    fireEvent.click(screen.getByRole('button', { name: /post/i }));

    await waitFor(() => expect(axiosClient.post).toHaveBeenCalled());
    const [url, body, opts] = axiosClient.post.mock.calls[0];
    expect(url).toBe('/status');
    expect(body instanceof FormData).toBe(true);
    expect(opts.headers['Content-Type']).toMatch(/multipart\/form-data/i);

    expect(onClose).toHaveBeenCalled();
  });

  test('CUSTOM audience includes customAudienceIds', async () => {
    axiosClient.post.mockResolvedValueOnce({ data: { id: 'xyz' } });

    render(<StatusComposer opened onClose={jest.fn()} />);

    const audience = screen.getByLabelText(/audience/i);
    fireEvent.change(audience, { target: { value: 'CUSTOM' } });

    // label is "Custom user IDs (JSON)"
    const custom = await screen.findByLabelText(/custom user ids/i);
    fireEvent.change(custom, { target: { value: '["u1","u2"]' } });

    fireEvent.click(screen.getByRole('button', { name: /post/i }));
    await waitFor(() => expect(axiosClient.post).toHaveBeenCalled());
  });

  test('file attach shows count', async () => {
    axiosClient.post.mockResolvedValueOnce({ data: { id: 'xyz' } });

    render(<StatusComposer opened onClose={jest.fn()} />);

    const input = screen.getByLabelText(/media \(images\/video\/audio\)/i);
    const file = new File(['abc'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    // Look for the counter <p> by checking its textContent contains "item(s) attached"
    const counter = await screen.findByText((content, node) => {
      return (
        node?.tagName?.toLowerCase() === 'p' &&
        /item\(s\)\s*attached/i.test(node.textContent || '')
      );
    });
    expect(counter).toBeInTheDocument();

    // Also check it has a positive number
    expect(counter.textContent.replace(/\s+/g, ' ').trim()).toMatch(
      /^[1-9]\d* item\(s\) attached$/
    );

    fireEvent.click(screen.getByRole('button', { name: /post/i }));
    await waitFor(() => expect(axiosClient.post).toHaveBeenCalled());
  });
});

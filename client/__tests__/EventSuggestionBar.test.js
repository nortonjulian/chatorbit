import { jest } from '@jest/globals';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../src/test-utils.js';
import EventSuggestionBar from '../src/components/EventSuggestionBar.jsx';

// Mock chrono to always return a start + end
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

// axiosClient mock — safe name prefix
const mockPost = jest.fn();
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: {
    post: (...a) => mockPost(...a),
  },
}));

// window.open + URL for download
beforeEach(() => {
  global.open = jest.fn();
  global.URL.createObjectURL = jest.fn(() => 'blob:link');
  global.URL.revokeObjectURL = jest.fn();
  mockPost.mockReset();
});


const messages = [
  { id: 1, decryptedContent: 'Let’s meet Jan 1st 10am' },
  { id: 2, content: 'another message' },
];

test('renders CTA when candidate found', () => {
  renderWithRouter(
    <EventSuggestionBar messages={messages} chatroom={{ id: 99, name: 'General' }} currentUser={{}} />
  );
  expect(screen.getByRole('button', { name: /add to calendar/i })).toBeInTheDocument();
});

test('opens modal and clicks Google + Outlook (posts toast)', async () => {
  renderWithRouter(
    <EventSuggestionBar messages={messages} chatroom={{ id: 5, name: 'General' }} currentUser={{}} />
  );

  await userEvent.click(screen.getByRole('button', { name: /add to calendar/i }));
  // Modal fields appear
  await userEvent.type(screen.getByLabelText(/title/i), ' Planning');
  await userEvent.click(screen.getByRole('button', { name: /google/i }));
  expect(global.open).toHaveBeenCalled();        // opened Google link
  await waitFor(() => expect(mockPost).toHaveBeenCalled()); // toast posted

  // Open again for Outlook
  await userEvent.click(screen.getByRole('button', { name: /add to calendar/i }));
  await userEvent.click(screen.getByRole('button', { name: /outlook/i }));
  expect(global.open).toHaveBeenCalledTimes(2);
});

test('downloads .ics and posts toast', async () => {
  mockPost
    .mockResolvedValueOnce({}) // first post (downloadIcs)
    .mockResolvedValueOnce({}); // second post (toast)

  renderWithRouter(
    <EventSuggestionBar messages={messages} chatroom={{ id: 7, name: 'General' }} currentUser={{}} />
  );

  await userEvent.click(screen.getByRole('button', { name: /add to calendar/i }));
  await userEvent.click(screen.getByRole('button', { name: /download \.ics/i }));

  await waitFor(() => {
    expect(mockPost).toHaveBeenCalled(); // at least once for ICS, once for toast
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
});

test('emails invite and posts toast', async () => {
  // Mock prompt to return an email list
  const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('a@b.com, c@d.com');

  renderWithRouter(
    <EventSuggestionBar messages={messages} chatroom={{ id: 8, name: 'General' }} currentUser={{}} />
  );

  await userEvent.click(screen.getByRole('button', { name: /add to calendar/i }));
  await userEvent.click(screen.getByRole('button', { name: /email invite/i }));

  await waitFor(() => expect(mockPost).toHaveBeenCalled());
  promptSpy.mockRestore();
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// --- Inline Mantine mock just for this test file ---
jest.mock('@mantine/core', () => {
  const React = require('react');
  return {
    __esModule: true,
    Modal: ({ opened, children, ...rest }) =>
      opened ? (
        <div role="dialog" aria-label="StatusViewer" data-opened="true" {...rest}>
          {children}
        </div>
      ) : null,
    Group: ({ children, ...rest }) => <div {...rest}>{children}</div>,
    Text: ({ children, ...rest }) => <span {...rest}>{children}</span>,
    ActionIcon: ({ children, onClick, disabled, ...rest }) => (
      <button onClick={onClick} disabled={!!disabled} {...rest}>
        {children}
      </button>
    ),
    Progress: ({ value, ...rest }) => <div data-testid="progress" data-value={value} {...rest} />,
    Badge: ({ children, ...rest }) => <span {...rest}>{children}</span>,
  };
});

// --- Axios client mock ---
jest.mock('../src/api/axiosClient', () => ({
  __esModule: true,
  default: { patch: jest.fn(), post: jest.fn() },
}));
import axiosClient from '../src/api/axiosClient';

// Shim portals so Mantine Modal content renders inline in tests
import ReactDOM from 'react-dom';
jest.spyOn(ReactDOM, 'createPortal').mockImplementation((node) => node);

// Component under test
import StatusViewer from '../src/components/StatusViewer';

const STORIES = [
  { id: 's1', caption: 'first', assets: [{ kind: 'IMAGE', url: '/img1.jpg' }] },
  { id: 's2', caption: 'second', assets: [{ kind: 'VIDEO', url: '/vid1.mp4' }] },
];

describe('StatusViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure axios calls return Promises so `.catch(...)` in the component is safe
    axiosClient.patch.mockResolvedValue({});
    axiosClient.post.mockResolvedValue({});
  });

  test('opens at index 0 and marks view', async () => {
    render(
      <StatusViewer
        opened
        onClose={jest.fn()}
        author={{ id: 'u1', username: 'alice' }}
        stories={STORIES}
      />
    );

    // Author + index indicator
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();

    // Marks first story viewed
    await waitFor(() =>
      expect(axiosClient.patch).toHaveBeenCalledWith('/status/s1/view')
    );
  });

  test('navigates next/prev and tracks views', async () => {
  render(
    <StatusViewer
      opened
      onClose={jest.fn()}
      author={{ id: 'u1', username: 'alice' }}
      stories={STORIES}
    />
  );

  // Click the "next" arrow (it's the last footer ActionIcon)
  const buttons = screen.getAllByRole('button');
  const nextBtn = buttons[buttons.length - 1];
  fireEvent.click(nextBtn);

  // We should now be on the 2nd story (caption "second"), and view should be tracked
  expect(await screen.findByText('second')).toBeInTheDocument();
  await waitFor(() =>
    expect(axiosClient.patch).toHaveBeenCalledWith('/status/s2/view')
  );

  // Click the "prev" arrow: find the button that contains the chevron-left svg
  const prevIcon = document.querySelector('.tabler-icon-chevron-left');
  const prevBtn = prevIcon?.closest('button');
  expect(prevBtn).toBeTruthy();
  fireEvent.click(prevBtn);

  // After going back, we should be on the 1st story: caption "first"
  expect(await screen.findByText('first')).toBeInTheDocument();

  // And the progress bar should reflect 1/2 => 50%
  const prog = screen.getByTestId('progress');
  expect(prog).toHaveAttribute('data-value', '50');
});


  test('close button triggers onClose', () => {
    const onClose = jest.fn();
    render(
      <StatusViewer
        opened
        onClose={onClose}
        author={{ id: 'u1', username: 'alice' }}
        stories={STORIES}
      />
    );

    // We don't have titles on ActionIcons; click buttons until onClose fires.
    const buttons = screen.getAllByRole('button');
    for (const b of buttons) {
      if (!onClose.mock.calls.length) {
        fireEvent.click(b);
      }
    }
    expect(onClose).toHaveBeenCalled();
  });
});

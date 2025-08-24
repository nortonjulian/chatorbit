/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';

// --- Inline mock for @mantine/core ---
jest.mock('@mantine/core', () => {
  const React = require('react');

  const strip = (props = {}) => {
    const {
      p, px, py, m, mx, my, c, ta, bg, fs, fw, mt, mb, ml, mr, mah, h, w,
      radius, withBorder, shadow, variant, size, gap, align, justify, wrap,
      centered, position, withArrow, padding, loading, withCloseButton,
      ...rest
    } = props;
    return rest;
  };

  const Div = (p) => React.createElement('div', strip(p), p.children);
  const MantineProvider = ({ children, ...rest }) =>
    React.createElement(React.Fragment, strip(rest), children);

  const Modal = ({ opened, title, children, ...rest }) => {
    if (!opened) return null;
    return React.createElement(
      'div',
      {
        role: 'dialog',
        'aria-label': typeof title === 'string' ? title : undefined,
        ...strip(rest),
      },
      title ? React.createElement('h2', null, title) : null,
      children
    );
  };

  const SimpleGrid = (p) => React.createElement('div', strip(p), p.children);
  const Image = ({ src, alt = '', onClick, ...rest }) =>
    React.createElement('img', { src, alt, onClick, ...strip(rest) });
  const Text = ({ children, ...rest }) => React.createElement('p', strip(rest), children);
  const Group = (p) => React.createElement('div', strip(p), p.children);
  const Button = ({ children, component, href, download, onClick, type = 'button', ...rest }) => {
    if (component === 'a') return React.createElement('a', { href, download, onClick, ...strip(rest) }, children);
    return React.createElement('button', { type, onClick, ...strip(rest) }, children);
  };

  return {
    __esModule: true,
    MantineProvider,
    Modal,
    SimpleGrid,
    Image,
    Text,
    Group,
    Button,
  };
});

// ---- messagesStore mock ----
const mockGetMediaInRoom = jest.fn();
jest.mock('../src/utils/messagesStore', () => ({
  __esModule: true,
  getMediaInRoom: (...args) => mockGetMediaInRoom(...args),
}));

import MediaGalleryModal from '../src/components/MediaGalleryModal.jsx';
import { renderWithRouter } from '../src/test-utils';

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders images/video/audio and opens viewer on image click', async () => {
  mockGetMediaInRoom.mockResolvedValueOnce([
    { id: 1, kind: 'IMAGE', url: 'http://x/img.jpg', caption: 'pic1' },
    { id: 2, kind: 'VIDEO', url: 'http://x/v.mp4' },
    { id: 3, kind: 'AUDIO', url: 'http://x/a.mp3' },
  ]);

  renderWithRouter(<MediaGalleryModal opened roomId={5} onClose={() => {}} />);

  // Gallery dialog shows
  expect(await screen.findByRole('dialog', { name: /shared media/i })).toBeInTheDocument();

  // Open viewer by clicking image
  await userEvent.click(await screen.findByRole('img', { name: /pic1/i }));

  // Scope to the viewer dialog (avoid duplicate text matches)
  const viewer = await screen.findByRole('dialog', { name: /pic1/i });
  expect(viewer).toBeInTheDocument();

  // Assert heading specifically (avoids duplicate with caption <p>)
  expect(within(viewer).getByRole('heading', { name: /pic1/i })).toBeInTheDocument();

  // Optionally also assert the caption <p> using selector to disambiguate
  expect(within(viewer).getByText(/pic1/i, { selector: 'p' })).toBeInTheDocument();

  // And the image inside viewer
  expect(within(viewer).getByRole('img', { name: /pic1/i })).toBeInTheDocument();
});

test('shows empty state when no media', async () => {
  mockGetMediaInRoom.mockResolvedValueOnce([]);

  renderWithRouter(<MediaGalleryModal opened roomId={42} onClose={() => {}} />);

  const gallery = await screen.findByRole('dialog', { name: /shared media/i });
  expect(gallery).toBeInTheDocument();
  expect(within(gallery).getByText(/no media cached locally yet/i)).toBeInTheDocument();
});

test('normalizes legacy fields (imageUrl) and reverses order (newest first)', async () => {
  mockGetMediaInRoom.mockResolvedValueOnce([
    { id: 101, imageUrl: 'http://x/legacy1.jpg', caption: 'legacy one' },
    { id: 102, kind: 'IMAGE', url: 'http://x/newer.jpg', caption: 'newest' },
  ]);

  renderWithRouter(<MediaGalleryModal opened roomId={7} onClose={() => {}} />);

  const gallery = await screen.findByRole('dialog', { name: /shared media/i });
  expect(gallery).toBeInTheDocument();

  const thumbs = await within(gallery).findAllByRole('img');
  expect(thumbs.length).toBeGreaterThanOrEqual(2);

  // Newest first due to reverse(); open the viewer
  await userEvent.click(thumbs[0]);

  const viewer = await screen.findByRole('dialog', { name: /newest/i });
  expect(viewer).toBeInTheDocument();

  // Heading (title) and caption <p> — use specific queries to avoid duplicates
  expect(within(viewer).getByRole('heading', { name: /newest/i })).toBeInTheDocument();
  expect(within(viewer).getByText(/newest/i, { selector: 'p' })).toBeInTheDocument();

  expect(within(viewer).getByRole('img', { name: /newest/i })).toBeInTheDocument();
});

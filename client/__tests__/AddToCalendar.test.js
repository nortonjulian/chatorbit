const React = require('react');
const { render, screen } = require('@testing-library/react');
require('@testing-library/jest-dom');

let AddToCalendar;
beforeAll(async () => {
  ({ default: AddToCalendar } = await import('../../client/src/components/AddToCalendar.jsx'));
});

const byText = (t) => screen.getByRole('link', { name: t });

describe('<AddToCalendar />', () => {
  const event = {
    title: 'ChatOrbit Live',
    description: 'Meet other users\nBring ideas',
    location: 'Denver, CO',
    startISO: '2025-09-30T18:00:00Z',
    endISO: '2025-09-30T19:15:00Z',
    url: 'https://app.chatorbit.com/event/xyz',
  };

  test('renders three links', () => {
    render(<AddToCalendar event={event} />);
    expect(byText('Download .ics')).toBeInTheDocument();
    expect(byText('Google Calendar')).toBeInTheDocument();
    expect(byText('Outlook')).toBeInTheDocument();
  });

  test('Google link encodes compressed UTC dates', () => {
    render(<AddToCalendar event={event} />);
    const href = byText('Google Calendar').getAttribute('href');
    expect(href).toMatch(/&dates=20250930T180000Z\/20250930T191500Z/);
    expect(href).toContain('text=ChatOrbit%20Live');
    expect(href).toContain('location=Denver%2C%20CO');
  });

  test('Outlook link uses ISO Z timestamps', () => {
    render(<AddToCalendar event={event} />);
    const href = byText('Outlook').getAttribute('href');
    expect(href).toMatch(/^https:\/\/outlook\.live\.com/);
    expect(href).toContain('startdt=2025-09-30T18%3A00%3A00.000Z');
    expect(href).toContain('enddt=2025-09-30T19%3A15%3A00.000Z');
  });

  test('ICS link includes params', () => {
    render(<AddToCalendar event={event} />);
    const href = byText('Download .ics').getAttribute('href');
    expect(href).toMatch(/^\/calendar\/ics\?/);
    expect(href).toContain('title=ChatOrbit%20Live');
    expect(href).toContain('location=Denver%2C%20CO');
  });
});

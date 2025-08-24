import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import SmartReplyBar from '../src/components/SmartReplyBar.jsx';

function renderWithMantine(ui) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

test('does not render with empty suggestions', () => {
  renderWithMantine(<SmartReplyBar suggestions={[]} />);
  // More robust than container.toBeEmptyDOMElement()
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('renders suggestions and calls onPick', async () => {
  const onPick = jest.fn();
  const user = userEvent.setup();

  renderWithMantine(
    <SmartReplyBar
      suggestions={[{ text: 'Sure!' }, { text: 'Sounds good' }]}
      onPick={onPick}
    />
  );

  // Both buttons are rendered
  expect(
    screen.getByRole('button', { name: /sure!/i })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /sounds good/i })
  ).toBeInTheDocument();

  // Clicking calls onPick with the button text
  await user.click(screen.getByRole('button', { name: /sure!/i }));
  expect(onPick).toHaveBeenCalledTimes(1);
  expect(onPick).toHaveBeenCalledWith('Sure!');
});

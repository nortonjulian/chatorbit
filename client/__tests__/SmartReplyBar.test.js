import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../src/test-utils';
import SmartReplyBar from '../src/components/SmartReplyBar.jsx';

test('does not render with empty suggestions', () => {
  const { container } = renderWithRouter(<SmartReplyBar suggestions={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test('renders suggestions and calls onPick', async () => {
  const onPick = jest.fn();
  renderWithRouter(
    <SmartReplyBar
      suggestions={[{ text: 'Sure!' }, { text: 'Sounds good' }]}
      onPick={onPick}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: /sure!/i }));
  expect(onPick).toHaveBeenCalledWith('Sure!');
});

import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// When using the Mantine mock above, importing from '@mantine/core' will give us a stub MantineProvider
import { MantineProvider } from '@mantine/core';

export function renderWithProviders(
  ui,
  { route = '/', router = true, ...options } = {}
) {
  const Wrapper = ({ children }) => {
    const content = router
      ? <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      : children;

    // Always wrap with MantineProvider (mocked one is cheap)
    return <MantineProvider>{content}</MantineProvider>;
  };

  return render(ui, { wrapper: Wrapper, ...options });
}

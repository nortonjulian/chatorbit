import { render } from '@testing-library/react';

let MemoryRouter;
try {
  // Lazily require so tests that don't have react-router-dom don't fail
  ({ MemoryRouter } = require('react-router-dom'));
} catch {
  // Fallback: just render children
  MemoryRouter = ({ children }) => <>{children}</>;
}

let MantineProvider;
try {
  ({ MantineProvider } = require('@mantine/core'));
} catch {
  MantineProvider = ({ children }) => <>{children}</>;
}

export function renderWithRouter(ui, options) {
  const routerProps = options?.router || {};
  return render(
    <MantineProvider>
      <MemoryRouter {...routerProps}>{ui}</MemoryRouter>
    </MantineProvider>,
    options
  );
}

// If you want a consistent provider wrapper without a router:
export function renderWithProviders(ui, options) {
  return render(<MantineProvider>{ui}</MantineProvider>, options);
}

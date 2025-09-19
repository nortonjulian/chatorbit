import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';

// --- Robust import of your app's UserContext (alias OR relative fallback) ---
let UserContextModule;
try {
  // Prefer your app alias if it's mapped
  // eslint-disable-next-line global-require
  UserContextModule = require('@/context/UserContextInstance.jsx');
} catch {
  try {
    // Fallback to common relative location
    // eslint-disable-next-line global-require
    UserContextModule = require('../src/context/UserContextInstance.jsx');
  } catch {
    try {
      // Last-ditch fallback in case the file is named differently
      // eslint-disable-next-line global-require
      UserContextModule = require('../src/context/UserContext.jsx');
    } catch (e) {
      // Provide a clearer error than Jest's resolver message
      // eslint-disable-next-line no-console
      console.error(e);
      throw new Error(
        "Could not resolve UserContext. Ensure it exists at 'src/context/UserContextInstance.jsx' (preferred) or 'src/context/UserContext.jsx'."
      );
    }
  }
}

const UserContext =
  UserContextModule.UserContext || UserContextModule.default;

if (!UserContext) {
  throw new Error(
    'Resolved context module does not export UserContext (named) or default.'
  );
}

// Re-export the bits your tests import from here
export { render, screen, waitFor };

/**
 * Wrap UI in providers your components expect.
 */
export function renderWithProviders(
  ui,
  {
    userCtx = {},
    route = '/',
    ...options
  } = {}
) {
  const value = {
    currentUser: null,
    setCurrentUser: () => {},
    authLoading: false,
    authError: null,
    logout: () => {},
    ...userCtx,
  };

  function Wrapper({ children }) {
    return (
      <MantineProvider>
        <MemoryRouter initialEntries={[route]}>
          <UserContext.Provider value={value}>{children}</UserContext.Provider>
        </MemoryRouter>
      </MantineProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Helper: supply a currentUser quickly.
 * Usage: render(<Comp/>, { wrapper: withUser(user) })
 */
export function withUser(user, extraCtx = {}) {
  return ({ children }) => (
    <MantineProvider>
      <MemoryRouter>
        <UserContext.Provider
          value={{
            currentUser: user,
            setCurrentUser: () => {},
            authLoading: false,
            authError: null,
            logout: () => {},
            ...extraCtx,
          }}
        >
          {children}
        </UserContext.Provider>
      </MemoryRouter>
    </MantineProvider>
  );
}

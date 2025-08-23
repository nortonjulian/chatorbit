import { render } from '@testing-library/react';

// Import the exact modules your components import:
import { UserContext } from '../src/context/UserContextInstance.jsx'; 

// Default mock value you can override per test
const defaultUserCtx = {
  currentUser: null,
  setCurrentUser: () => {},
};

export function renderWithProviders(ui, { userCtx = {}, ...options } = {}) {
  const value = { ...defaultUserCtx, ...userCtx };

  function Wrapper({ children }) {
    return (
      <UserContext.Provider value={value}>
        {children}
      </UserContext.Provider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

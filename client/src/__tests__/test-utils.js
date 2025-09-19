import React from 'react';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import { render } from '@testing-library/react';

// Minimal user context shim
const UserContext = React.createContext({ currentUser: null, setCurrentUser: () => {} });

export function withUser(user) {
  const Wrapper = ({ children }) => (
    <MantineProvider withGlobalStyles withNormalizeCSS>
      <UserContext.Provider value={{ currentUser: user, setCurrentUser: () => {} }}>
        <BrowserRouter>{children}</BrowserRouter>
      </UserContext.Provider>
    </MantineProvider>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}

export * from '@testing-library/react';
export { UserContext, render };

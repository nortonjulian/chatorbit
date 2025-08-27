import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider /*, createTheme*/ } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import { BrowserRouter } from 'react-router-dom';
import { UserProvider } from './context/UserContext.jsx'; // <-- ensure this really exports UserProvider
// import { UserProvider } from './context/UserContextInstance.jsx'; // use this path if needed
import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary';
import './i18n';

// Optional: use createTheme(...) instead; object also works
const theme = {
  fontFamily:
    'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  defaultRadius: 'lg',
  colors: {
    orbit: ['#e7f1ff','#c9dfff','#a9ccff','#86b6ff','#63a0ff','#418aff','#2f73e6','#255bb4','#1b4483','#122c52'],
    orbitYellow: ['#fff9e6','#ffefbf','#ffe596','#ffdb6b','#ffd241','#ffc818','#e0ab00','#b38700','#856400','#573e00'],
  },
  primaryColor: 'orbit',
  primaryShade: 6,
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <Notifications position="top-right" />
        <BrowserRouter>
          <UserProvider>
            <App />
          </UserProvider>
        </BrowserRouter>
      </MantineProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

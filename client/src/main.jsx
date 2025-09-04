import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './styles.css';
import './i18n';

import { UserProvider } from './context/UserContext';
import { CallProvider } from './context/CallContext';
import ErrorBoundary from './ErrorBoundary';
import App from './App.jsx';

const theme = createTheme({
  fontFamily:
    'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  defaultRadius: 'xl',
  colors: {
    orbit: [
      '#e7f1ff','#c9dfff','#a9ccff','#86b6ff','#63a0ff',
      '#418aff','#2f73e6','#255bb4','#1b4483','#122c52',
    ],
    orbitYellow: [
      '#fff9e6','#ffefbf','#ffe596','#ffdb6b','#ffd241',
      '#ffc818','#e0ab00','#b38700','#856400','#573e00',
    ],
  },
  primaryColor: 'orbit',
  primaryShade: 6,
  components: {
    TextInput:     { defaultProps: { size: 'md', variant: 'filled' } },
    PasswordInput: { defaultProps: { size: 'md', variant: 'filled' } },
    Button:        { defaultProps: { radius: 'xl', size: 'md' } },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <UserProvider>
          <CallProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </CallProvider>
        </UserProvider>
      </MantineProvider>
    </ErrorBoundary>
</React.StrictMode>
);


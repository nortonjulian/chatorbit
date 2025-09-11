import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/react';
import { Replay } from '@sentry/replay';

import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter } from 'react-router-dom';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './styles.css';
import './i18n';

import { UserProvider } from './context/UserContext';
import { CallProvider } from './context/CallContext';
import ErrorBoundary from './ErrorBoundary';
import App from './App.jsx';

const isProd = import.meta.env.MODE === 'production';

if (isProd && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_COMMIT_SHA, // keep this name consistent with your CI
    integrations: [
      new BrowserTracing(),
      new Replay(),
    ],
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_RATE ?? 0.15),
    // Caution: tune these for cost/privacy
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

// --- Mantine theme config ---
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
        <Notifications position="top-right" />
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

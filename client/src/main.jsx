import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';

import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter } from 'react-router-dom';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './styles.css';
import './i18n';

import { SocketProvider } from './context/SocketContext';
import { UserProvider } from './context/UserContext';
import { CallProvider } from './context/CallContext';
import { AdProvider } from './ads/AdProvider.jsx';

import ErrorBoundary from './ErrorBoundary';
import App from './App.jsx';
import { chatOrbitTheme } from './theme';
import { primeCsrf } from './api/axiosClient';

const isProd = import.meta.env.PROD;

/* ---------------- Sentry (prod only) ---------------- */
if (isProd && import.meta.env.VITE_SENTRY_DSN) {
  (async () => {
    const integrations = [Sentry.browserTracingIntegration()];

    if (import.meta.env.VITE_SENTRY_REPLAY === 'true') {
      try {
        const { replayIntegration } = await import('@sentry/replay');
        integrations.push(replayIntegration());
      } catch {
        // eslint-disable-next-line no-console
        console.warn('[sentry] @sentry/replay not installed; continuing without it');
      }
    }

    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_COMMIT_SHA,
      integrations,
      tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_RATE ?? 0.15),
      // (only used if Replay is enabled)
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  })();
}

/* ------------- Dev-only a11y audit (best-effort) ------------- */
if (import.meta.env.DEV) {
  Promise.all([import('@axe-core/react'), import('react'), import('react-dom')])
    .then(([{ default: axe }, ReactMod, ReactDOMMod]) => {
      const ReactForAxe = ReactMod.default || ReactMod;
      const ReactDOMForAxe = ReactDOMMod.default || ReactDOMMod;
      setTimeout(() => axe(ReactForAxe, ReactDOMForAxe, 1000), 0);
    })
    .catch(() => {});
}

/* ---------------- Theming helpers ---------------- */
function getInitialScheme() {
  const saved = localStorage.getItem('co-theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
}

const theme = createTheme({
  ...chatOrbitTheme,
  primaryShade: 6,
  components: {
    TextInput: { defaultProps: { size: 'md', variant: 'filled' } },
    PasswordInput: { defaultProps: { size: 'md', variant: 'filled' } },
    Button: { defaultProps: { radius: 'xl', size: 'md' } },
  },
});

/* ---------------- Root ---------------- */
function Root() {
  const [scheme, setScheme] = React.useState(getInitialScheme());

  // Prime CSRF cookie/header once at app startup
  React.useEffect(() => {
    primeCsrf();
  }, []);

  React.useEffect(() => {
    localStorage.setItem('co-theme', scheme);
    document.documentElement.setAttribute('data-theme', scheme);
  }, [scheme]);

  return (
    <ErrorBoundary>
      <MantineProvider theme={theme} defaultColorScheme={scheme}>
        <Notifications position="top-right" limit={3} />
        {/* IMPORTANT: SocketProvider must wrap UserProvider */}
        <SocketProvider>
          <UserProvider>
            {/* AdProvider needs to be inside UserProvider so it can read plan and disable ads for Premium */}
            <AdProvider>
              <CallProvider>
                <BrowserRouter>
                  <App
                    themeScheme={scheme}
                    onToggleTheme={() =>
                      setScheme((s) => (s === 'light' ? 'dark' : 'light'))
                    }
                  />
                </BrowserRouter>
              </CallProvider>
            </AdProvider>
          </UserProvider>
        </SocketProvider>
      </MantineProvider>
    </ErrorBoundary>
  );
}

/* ---------------- Mount ---------------- */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

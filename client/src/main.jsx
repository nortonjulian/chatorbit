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
import { SocketProvider } from './context/SocketContext';
import ErrorBoundary from './ErrorBoundary';
import App from './App.jsx';

// ✅ import your brand theme
import { chatOrbitTheme } from './theme';

const isProd = import.meta.env.MODE === 'production';

if (isProd && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_COMMIT_SHA,
    integrations: [new BrowserTracing(), new Replay()],
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_RATE ?? 0.15),
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

// DEV-only a11y audit
if (import.meta.env.DEV) {
  Promise.all([
    import('@axe-core/react'),
    import('react'),
    import('react-dom'),
  ])
    .then(([{ default: axe }, ReactMod, ReactDOMMod]) => {
      const ReactForAxe = ReactMod.default || ReactMod;
      const ReactDOMForAxe = ReactDOMMod.default || ReactDOMMod;
      // run after a tick so the root is present
      setTimeout(() => axe(ReactForAxe, ReactDOMForAxe, 1000), 0);
    })
    .catch(() => {
      // ignore axe load errors in dev
    });
}

/** Persisted color scheme (light/dark) */
function getInitialScheme() {
  const saved = localStorage.getItem('co-theme');
  if (saved === 'dark' || saved === 'light') return saved;
  // fall back to system preference
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
}

/**
 * Compose final Mantine theme:
 * - Start from chatOrbitTheme (orbitBlue/orbitYellow, font family, radius)
 * - Add primaryShade and component defaults
 */
const theme = createTheme({
  ...chatOrbitTheme,
  primaryShade: 6,
  components: {
    TextInput:     { defaultProps: { size: 'md', variant: 'filled' } },
    PasswordInput: { defaultProps: { size: 'md', variant: 'filled' } },
    Button:        { defaultProps: { radius: 'xl', size: 'md' } },
  },
});

function Root() {
  const [scheme, setScheme] = React.useState(getInitialScheme());

  React.useEffect(() => {
    localStorage.setItem('co-theme', scheme);
    document.documentElement.setAttribute('data-theme', scheme);
  }, [scheme]);

  return (
    <ErrorBoundary>
      <MantineProvider theme={theme} defaultColorScheme={scheme}>
        <Notifications position="top-right" limit={3} />
        <UserProvider>
          <CallProvider>
            <SocketProvider>
              <BrowserRouter>
                <App
                  themeScheme={scheme}
                  onToggleTheme={() => setScheme((s) => (s === 'light' ? 'dark' : 'light'))}
                />
              </BrowserRouter>
            </SocketProvider>
          </CallProvider>
        </UserProvider>
      </MantineProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

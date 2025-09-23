import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';

import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter } from 'react-router-dom';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './styles.css';
import './styles/themes.css';

import './i18n';

import { AdProvider } from './ads/AdProvider';
import { SocketProvider } from './context/SocketContext';
import { UserProvider } from './context/UserContext';
import { CallProvider } from './context/CallContext';

import ErrorBoundary from './ErrorBoundary';
import App from './App.jsx';
import { chatOrbitTheme } from './theme';
import { primeCsrf } from './api/axiosClient';

// a11y + perf helpers
import SkipToContent from "./components/SkipToContent.jsx";
import A11yAnnouncer from './components/A11yAnnouncer.jsx';
import { initWebVitals } from './utils/perf/vitals.js';

// THEME MANAGER: single source of truth
import { applyTheme, getTheme, onThemeChange, setTheme } from './utils/themeManager';
applyTheme(); // apply stored/default theme on boot

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

/* ---------------- Mantine theme ---------------- */
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
  // Mantine needs 'light' | 'dark' only; map current theme to that bucket.
  const [scheme, setScheme] = React.useState(getTheme() === 'dark' ? 'dark' : 'light');

  // Prime CSRF cookie/header once at app startup
  React.useEffect(() => {
    primeCsrf();
  }, []);

  // Reflect external theme changes (e.g., ThemeSelect) into Mantine scheme
  React.useEffect(() => {
    const unsub = onThemeChange((t) => setScheme(t === 'dark' ? 'dark' : 'light'));
    return unsub;
  }, []);

  // start collecting Web Vitals (lazy-loaded)
  React.useEffect(() => {
    initWebVitals();
  }, []);

  return (
    <ErrorBoundary>
      <MantineProvider theme={theme} defaultColorScheme={scheme}>
        <Notifications position="top-right" limit={3} />

        {/* a11y helpers mounted once */}
        <SkipToContent targetId="main-content" />
        <A11yAnnouncer />

        {/* IMPORTANT: SocketProvider must wrap UserProvider */}
        <SocketProvider>
          <UserProvider>
            {/* AdProvider inside UserProvider so it can read plan and disable ads for Premium */}
            <AdProvider>
              <CallProvider>
                <BrowserRouter>
                  <App
                    themeScheme={scheme}
                    onToggleTheme={() => {
                      // Drive through themeManager (single source of truth)
                      const next = scheme === 'light' ? 'dark' : 'light';
                      setTheme(next);
                    }}
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

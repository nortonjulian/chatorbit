import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: '<your-sentry-org>',
      project: '<your-sentry-project-frontend>',
      authToken: process.env.SENTRY_AUTH_TOKEN, // set in CI only
      release: process.env.VITE_COMMIT_SHA,     // injected in CI
      sourcemaps: { filesToDeleteAfterUpload: ['**/*.map'] },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    sourcemap: true, // required so Sentry can upload sourcemaps
  },
});

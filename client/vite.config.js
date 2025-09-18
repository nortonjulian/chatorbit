import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(async ({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const plugins = [react()];
  let enableSourcemaps = false;

  const hasSentryEnv =
    !!env.VITE_SENTRY_ORG &&
    !!env.VITE_SENTRY_PROJECT &&
    !!env.SENTRY_AUTH_TOKEN;

  // Only attempt Sentry upload on production builds when env is configured.
  if (command === 'build' && hasSentryEnv) {
    try {
      const { sentryVitePlugin } = await import('@sentry/vite-plugin');
      plugins.push(
        sentryVitePlugin({
          org: env.VITE_SENTRY_ORG,
          project: env.VITE_SENTRY_PROJECT,
          authToken: env.SENTRY_AUTH_TOKEN, // set in CI
          release:
            env.VITE_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
          sourcemaps: { assets: './dist/**' },
          telemetry: false,
        })
      );
      enableSourcemaps = true; // only generate sourcemaps when uploading
    } catch {
      console.warn(
        '[vite] @sentry/vite-plugin not installed; skipping Sentry upload.'
      );
    }
  }

  const apiTarget = env.VITE_API_BASE || 'http://localhost:5002';

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: [
        'react',
        'react-dom',
        '@mantine/core',
        '@mantine/hooks',
        '@mantine/notifications',
        '@mantine/dates',
      ],
    },
    build: { sourcemap: enableSourcemaps },
    server: {
      host: true,
      port: 5173,
      cors: true,
      proxy: {
        // Proxy API to avoid CORS in dev
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        // If you use Socket.IO or websockets, proxy them too
        '/socket.io': {
          target: apiTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: { port: 5174 },
  };
});

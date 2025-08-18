import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [],          // add e.g. './src/test/setup.ts' later
    globals: true,
  },
});

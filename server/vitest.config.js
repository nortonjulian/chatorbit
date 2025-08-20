import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.{test,spec}.js'],
    setupFiles: ['tests/setup-env.js'],
    testTimeout: 15000,   // socket tests need a bit more headroom
    hookTimeout: 15000
  }
});

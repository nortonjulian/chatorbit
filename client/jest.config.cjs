/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',

  // Tell Jest how to transform source (JS/TS/JSX/TSX) with Babel
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },

  // Let Jest resolve these extensions
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],

  // Run these BEFORE the environment is ready (polyfills, globals)
  setupFiles: [
    '<rootDir>/src/tests/setup-webcrypto.js',
    '<rootDir>/jest.polyfills.cjs',
    '<rootDir>/src/tests/setup-webrtc.js',
  ],

  // Run AFTER the environment is ready (RTL, mocks, shims)
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],

  // Map non-JS imports and path aliases
  moduleNameMapper: {
    // styles & assets
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg|webp|mp3|mp4)$': '<rootDir>/__tests__/__mocks__/fileMock.js',

    // aliases
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@src/config$': '<rootDir>/__tests__/__mocks__/config.js',

    // ❌ DO NOT map @mantine/* to test mocks anymore
    // '^@mantine/core$': '<rootDir>/__tests__/__mocks__/@mantine/core.js',
    // '^@mantine/spotlight$': '<rootDir>/__tests__/__mocks__/@mantine/spotlight.js',
    // '^@mantine/hooks$': '<rootDir>/__tests__/__mocks__/@mantine/hooks.js',
  },

  // Transpile selected ESM deps (Mantine and a few)
  transformIgnorePatterns: [
    '/node_modules/(?!(@mantine|@tabler/icons-react|@floating-ui|use-sync-external-store)/)',
  ],

  // Which files are tests
  testMatch: [
    '<rootDir>/__tests__/**/*.test.js',
    '<rootDir>/__tests__/**/*.test.jsx',
    '<rootDir>/src/**/*.test.js',
    '<rootDir>/src/**/*.test.jsx',
    '<rootDir>/**/*.spec.js',
    '<rootDir>/**/*.spec.jsx',
  ],

  roots: ['<rootDir>'],
};

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',

  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },

  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],

  // Run the WebCrypto shim before any test files load, then your other polyfills
  setupFiles: [
    '<rootDir>/src/tests/setup-webcrypto.js',
    '<rootDir>/jest.polyfills.cjs',
  ],

  // Test helpers, assertions, etc. that should run after env is ready
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],

  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg|webp|mp3|mp4)$': '<rootDir>/__tests__/__mocks__/fileMock.js',
    '^@src/(.*)$': '<rootDir>/src/$1',
  },

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

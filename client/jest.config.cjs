/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',

  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },

  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],

  setupFiles: [
    '<rootDir>/src/tests/setup-webcrypto.js',
    '<rootDir>/jest.polyfills.cjs',
    '<rootDir>/src/tests/setup-webrtc.js',
  ],

  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.cjs',
  ],

  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg|webp|mp3|mp4)$': '<rootDir>/__tests__/__mocks__/fileMock.js',
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@src/config$': '<rootDir>/__tests__/__mocks__/config.js',

    '^@mantine/core$': '<rootDir>/__tests__/__mocks__/@mantine/core.js',
    '^@mantine/spotlight$': '<rootDir>/__tests__/__mocks__/@mantine/spotlight.js',
    '^@mantine/hooks$': '<rootDir>/__tests__/__mocks__/@mantine/hooks.js',
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

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.js'],
  transform: {},                 // no Babel; use Node's ESM via NODE_OPTIONS
  verbose: true,

  // Map imports to our test doubles (works no matter where they're imported from)
  moduleNameMapper: {
    'middleware\\/auth\\.js$': '<rootDir>/__tests__/mocks/auth.mock.js',
    'middleware\\/plan\\.js$': '<rootDir>/__tests__/mocks/plan.mock.js',
    '^@sentry/node$': '<rootDir>/__tests__/mocks/sentry.node.mock.js',
    '^@sentry/profiling-node$': '<rootDir>/__tests__/mocks/sentry.profiling.mock.js',
  },
};

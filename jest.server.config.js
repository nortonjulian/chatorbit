export default {
  displayName: 'server',
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/server/**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.int\\.test\\.js$', // ignore parked integration tests
  ],
  transform: { '^.+\\.jsx?$': 'babel-jest' },
  // REMOVE extensionsToTreatAsEsm for .js — Jest infers it from "type":"module"
  moduleFileExtensions: ['js', 'json'],
  collectCoverageFrom: [
    'server/**/*.{js,jsx}',
    '!server/**/node_modules/**',
    '!server/**/*.int.test.js',
    '!server/**/__mocks__/**',
  ],
  coverageDirectory: '<rootDir>/coverage/server',
  setupFiles: ['<rootDir>/server/__tests__/test.env.setup.js'], // not a test file
}

export default {
  displayName: 'client',
  rootDir: '.',
  testEnvironment: 'jsdom',
  testMatch: [
    '<rootDir>/client/src/**/*.test.js',
    '<rootDir>/client/__tests__/**/*.test.js',
    '<rootDir>/client/_tests_/**/*.test.js'
  ],
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  setupFilesAfterEnv: ['<rootDir>/client/__tests__/setupTests.js'],
  moduleNameMapper: {
    '^@mantine/core$': '<rootDir>/client/__tests__/__mocks__/mantine.js',
    '^react-router-dom$': '<rootDir>/client/__tests__/__mocks__/react-router-dom.js',
    '\\.(css|less|scss|sass)$': '<rootDir>/client/__mocks__/styleMock.js',
    '\\.(gif|ttf|eot|svg|png|jpg|mp3|wav)$': '<rootDir>/client/__mocks__/fileMock.js',
    '^@/test-utils$': '<rootDir>/client/test-utils.js',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/client/src/tests/',
    '\\.int\\.test\\.js$'
  ]
};

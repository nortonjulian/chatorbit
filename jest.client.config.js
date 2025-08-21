// jest.client.config.js
export default {
  displayName: 'client',
  rootDir: '.',
  testEnvironment: 'jest-environment-jsdom',
  testMatch: [
    '<rootDir>/client/src/**/*.test.js',       // co-located tests
    '<rootDir>/client/__tests__/**/*.test.js', // if you use __tests__
    '<rootDir>/client/_tests_/**/*.test.js'    // if you use _tests_
  ],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest'
  },
  setupFilesAfterEnv: [
    '<rootDir>/client/src/setupTests.js',
    '<rootDir>/node_modules/@testing-library/jest-dom/dist/index.js'
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/client/__mocks__/styleMock.js',
    '\\.(gif|ttf|eot|svg|png|jpg|mp3|wav)$': '<rootDir>/client/__mocks__/fileMock.js'
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/client/src/tests/', // old Vitest folder
    '\\.int\\.test\\.js$'
  ]
};

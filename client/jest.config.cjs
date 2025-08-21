/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'client-jsdom',
      rootDir: '<rootDir>',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/__tests__/**/*.(test|spec).[jt]s?(x)',
        '<rootDir>/src/**/*.(test|spec).[jt]s?(x)',
      ],
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.dom.js'],
      moduleNameMapper: {
        '\\.(css|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
        '\\.(png|jpe?g|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      transform: {
        '^.+\\.[jt]sx?$': [
          'babel-jest',
          {
            presets: [
              ['@babel/preset-env', { targets: { node: 'current' }, modules: 'auto' }],
              ['@babel/preset-react', { runtime: 'automatic' }],
            ],
          },
        ],
      },
      // DO NOT include '.js' here when package.json has "type":"module"
      extensionsToTreatAsEsm: ['.jsx', '.ts', '.tsx'],
      transformIgnorePatterns: ['/node_modules/'],
    },
    {
      displayName: 'client-node',
      rootDir: '<rootDir>',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/__tests__/**/*.(node|crypto|backup).(test|spec).[jt]s?(x)',
        '<rootDir>/src/**/*.(node|crypto|backup).(test|spec).[jt]s?(x)',
      ],
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.node.js'],
      transform: {
        '^.+\\.[jt]sx?$': [
          'babel-jest',
          { presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'auto' }]] },
        ],
      },
      // DO NOT include '.js' here when package.json has "type":"module"
      extensionsToTreatAsEsm: ['.jsx', '.ts', '.tsx'],
      transformIgnorePatterns: ['/node_modules/'],
    },
  ],
  verbose: true,
};

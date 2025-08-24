// export default {
//   projects: [
//     '<rootDir>/jest.server.config.js',
//     '<rootDir>/jest.client.config.js',
//   ],
// };

// jest.config.js at repo root
module.exports = {
  projects: [
    // Let the client use its own config
    '<rootDir>/client',

    // Inline project config for the server (or just point to server/jest.config.js)
    {
      displayName: 'server',
      rootDir: '<rootDir>/server',
      testEnvironment: 'node',
      // IMPORTANT: this path is relative to rootDir (i.e., /server)
      setupFiles: ['<rootDir>/__tests__/test.env.setup.js'],
      transform: {},
      testMatch: ['**/__tests__/**/*.test.js'],
    },
  ],
};

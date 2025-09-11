// export default {
//   projects: [
//     '<rootDir>/jest.server.config.js',
//     '<rootDir>/jest.client.config.js',
//   ],
// };

// jest.config.js at repo root
// module.exports = {
//   projects: [
//     // Let the client use its own config
//     '<rootDir>/client',

//     // Inline project config for the server (or just point to server/jest.config.js)
//     {
//       displayName: 'server',
//       rootDir: '<rootDir>/server',
//       testEnvironment: 'node',
//       extensionsToTreatAsEsm: ['.js'],
//       // IMPORTANT: this path is relative to rootDir (i.e., /server)
//       // setupFiles: ['<rootDir>/__tests__/test.env.setup.js'],
//       transform: {},
//       injectGlobals: true,           // allow `test`/`expect` without import
//       testMatch: ['**/__tests__/**/*.test.js'],
//       testPathIgnorePatterns: ['/node_modules/'],
//     },
//   ],
// };

// server/jest.config.cjs
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.js'],
  transform: {},                 // no Babel; use Node's ESM (we pass NODE_OPTIONS)
  verbose: true,
};

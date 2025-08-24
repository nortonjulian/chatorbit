export default {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/__tests__/**/*.test.js'],
  transform: {}, // no Babel/TS; run pure ESM
  setupFilesAfterEnv: ['<rootDir>/test.env.setup.js'],
  // DO NOT set extensionsToTreatAsEsm when "type":"module" is present
};

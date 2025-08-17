module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
    'import/resolver': { node: { extensions: ['.js', '.jsx'] } },
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:prettier/recommended', // turns on plugin:prettier + shows Prettier issues as ESLint errors
  ],
  rules: {
    // React 17+ new JSX transform (no need to import React)
    'react/react-in-jsx-scope': 'off',
    // If you don’t use PropTypes
    'react/prop-types': 'off',

    // Import hygiene
    'import/order': [
      'warn',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
          'object',
          'type',
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],

    // Friendly unused warnings (allow _prefixed)
    'no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
  overrides: [
    // Server-side files
    {
      files: ['server/**/*.js'],
      env: { node: true, browser: false },
      rules: {
        // server-specific tweaks (add if needed)
      },
    },
    // Client-side files
    {
      files: ['client/**/*.{js,jsx}'],
      env: { browser: true, node: false },
      rules: {
        // client-specific tweaks (add if needed)
      },
    },
    // config files
    {
      files: ['**/*.config.js', '**/*.config.cjs', '**/*.config.mjs'],
      env: { node: true },
    },
  ],
};

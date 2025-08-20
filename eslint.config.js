import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';

import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier'; // disables rules that conflict with Prettier

export default defineConfig([
  // ignore build artifacts etc.
  globalIgnores(['dist', 'build', 'node_modules']),

  // Base for all JS/JSX
  {
    files: ['**/*.{js,jsx}'],

    // Flat-config "extends"
    extends: [
      js.configs.recommended,
      // Plugins' flat presets
      react.configs.recommended,
      reactHooks.configs['recommended-latest'],
      jsxA11y.configs.recommended,
      importPlugin.flatConfigs.recommended, // eslint-plugin-import flat preset
      reactRefresh.configs.vite,
      // Keep Prettier last to turn off stylistic rules that clash
      prettierConfig,
    ],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser, // default to browser; server files override below
      },
    },

    // Plugin list (so rules can reference them explicitly if needed)
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
    },

    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        node: { extensions: ['.js', '.jsx'] },
      },
    },

    rules: {
      // React 17+ (no need to import React)
      'react/react-in-jsx-scope': 'off',
      // If you don’t use PropTypes
      'react/prop-types': 'off',

      // Import hygiene (keeps your original ordering/alphabetize)
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

      // Friendly unused warnings (allow _-prefixed)
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Server-side overrides
  {
    files: ['server/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Client-side overrides (explicit, though base already uses browser globals)
  {
    files: ['client/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  // Config files run in Node
  {
    files: ['**/*.config.{js,cjs,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
]);

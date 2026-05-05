// ESLint v9 flat config
const expoConfig = require('eslint-config-expo/flat');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = [
  ...expoConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      // No `any`. Use `unknown` and narrow.
      '@typescript-eslint/no-explicit-any': 'error',

      // Unused vars must start with _ to signal intent.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // We always want explicit return types on exported functions.
      '@typescript-eslint/explicit-module-boundary-types': 'warn',

      // No `console.log` in committed code (use the logger).
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // React Hooks rules.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Prefer const, no var.
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'web-build/**', 'ios/**', 'android/**'],
  },
];

import base from './base.js';
import n from 'eslint-plugin-n';
import globals from 'globals';

/**
 * Node.js (Express BE) app용 ESLint config.
 * BE 앱(auth-api/4 api 앱) eslint.config.js가 이걸 spread.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export default [
  ...base,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    plugins: { n },
    rules: {
      'n/no-process-exit': 'error',
      'n/no-deprecated-api': 'error',
      'n/handle-callback-err': ['error', '^err'],
      'no-console': 'off',
    },
  },
];

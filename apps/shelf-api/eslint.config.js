import node from '@getit/config-eslint/node';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...node,
  {
    ignores: ['node_modules/**', 'dist/**', 'prisma/migrations/**', 'coverage/**'],
  },
];

import baseConfig from '@getit/config-eslint/base.js';

/**
 * 루트 ESLint config — workspace 전반의 fallback.
 * 각 app/package는 자기 폴더에 별도 eslint.config.js를 둘 수 있음.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export default [
  ...baseConfig,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/coverage/**',
      '.gstack/**',
      '.claude/**',
    ],
  },
];

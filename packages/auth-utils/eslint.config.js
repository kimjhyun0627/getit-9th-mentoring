import globals from 'globals';

import base from '@getit/config-eslint/base';

/**
 * auth-utils — server.js는 Node, client.js는 브라우저 모두에서 동작.
 * globals를 둘 다 풀어줌.
 */
export default [
  ...base,
  {
    files: ['src/client.js'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
];

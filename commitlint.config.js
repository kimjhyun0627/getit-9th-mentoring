/**
 * Commitlint — Conventional Commits 강제.
 * scope는 모노레포 앱/패키지 이름.
 *
 * @type {import('@commitlint/types').UserConfig}
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'test', 'docs', 'chore', 'style', 'perf', 'build', 'ci'],
    ],
    'scope-enum': [
      1,
      'always',
      [
        'landing',
        'auth-web',
        'auth-api',
        'hobby-web',
        'hobby-api',
        'shelf-web',
        'shelf-api',
        'board-web',
        'board-api',
        'letter-web',
        'letter-api',
        'theme',
        'auth-utils',
        'config-tailwind',
        'config-eslint',
        'schemas',
        'infra',
        'ci',
        'deps',
        'repo',
      ],
    ],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
  },
};

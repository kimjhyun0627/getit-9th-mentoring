import node from '@getit/config-eslint/node';

/**
 * env-validator — Node 전용 패키지. server.js 부팅 진입점에서만 사용.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export default [...node];

/**
 * board-api 부팅 시점 env 검증 (Issue #575).
 *
 * board-api 는 SMTP 미사용 → JWT_SECRET 만 검사. production placeholder/누락 시
 * throw → 컨테이너 즉시 종료. dev/test 위반은 warnings 로 흘림.
 *
 * 별도 모듈로 분리한 이유 — CR #579 thread 1 의 boot path 회귀 가드 (Vitest 직접
 * import 가능해야 함).
 *
 * @param {{ env?: Record<string, string | undefined>, log?: { warn: (...args: unknown[]) => void } }} [deps]
 */
import { validateJwtSecret } from '@getit/env-validator';

export const validateEnvOrDie = (deps = {}) => {
  const env = deps.env ?? process.env;
  const log = deps.log ?? { warn: () => {} };
  const warnings = validateJwtSecret(env.JWT_SECRET, { env: env.NODE_ENV });
  for (const w of warnings) log.warn({ env: 'validation' }, w);
};

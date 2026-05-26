/**
 * 학교 인증 가드 env fail-fast 검증 (#572).
 *
 * 배경:
 *  - `SCHOOL_AUTH_GUARD_ENABLED === 'true'` 일 때만 가드가 차단. 그 외 값/미정의 면 no-op.
 *  - 운영에서 변수 누락 시 가드가 silent disable → 미인증 사용자가 hobby mutation 통과.
 *  - PRD 정책 (`.claude/projects/hobby.md`, `school-auth.md`) 위반 silent 금지.
 *
 * 정책:
 *  - `NODE_ENV === 'production'` 이고 `SCHOOL_AUTH_GUARD_ENABLED !== 'true'` 면 throw.
 *    `undefined`, `'false'`, `''`, 오타 모두 동일하게 차단 — 명시적 opt-in 만 허용.
 *  - dev/test 환경에서는 미정의 허용 (회귀 없음, 로컬 부팅 깨짐 방지).
 *
 * @param {NodeJS.ProcessEnv} [env] — 테스트에서 주입. 생략 시 `process.env`.
 * @throws {Error} prod 에서 미정의/잘못된 값일 때.
 */
export const assertSchoolAuthEnvDeclared = (env = process.env) => {
  if (env.NODE_ENV !== 'production') return;
  if (env.SCHOOL_AUTH_GUARD_ENABLED === 'true') return;

  const present = Object.prototype.hasOwnProperty.call(env, 'SCHOOL_AUTH_GUARD_ENABLED');
  const reason = present
    ? `SCHOOL_AUTH_GUARD_ENABLED=${JSON.stringify(env.SCHOOL_AUTH_GUARD_ENABLED)} (must be exactly "true")`
    : 'SCHOOL_AUTH_GUARD_ENABLED is not set';
  throw new Error(
    `[hobby-api] Refusing to start in production: ${reason}. ` +
      'PRD 정책상 학교 인증 가드는 prod 에서 반드시 켜져 있어야 한다. ' +
      '의도적으로 끄려면 .env.prod 에서 SCHOOL_AUTH_GUARD_ENABLED=false 로 명시하고 코드도 같이 수정.',
  );
};

/**
 * auth-api 부팅 시점 env 검증 (Issue #575).
 *
 * production 환경에서 JWT_SECRET / SMTP 설정이 누락 or placeholder 면 throw —
 * `main()` 진입점에서 호출돼 컨테이너를 즉시 종료시킨다 (헬스체크 cascade).
 *
 * server.js 의 직접 인라인이 아니라 별도 모듈로 분리한 이유:
 *   - Vitest 로 boot path 가 실제로 fail-fast 하는지 회귀 가드 (CR #579 thread 1)
 *   - dev/test env 에선 warnings 만 흘리고 통과하는 분기 검증
 *
 * 비밀값 자체는 절대 메시지/로그에 노출되지 않는다 (validator 책임).
 *
 * @param {{ env?: Record<string, string | undefined>, log?: { warn: (...args: unknown[]) => void } }} [deps]
 * @returns {void}
 * @throws {Error} production + 위반.
 */
import { validateJwtSecret, validateSmtpConfig } from '@getit/env-validator';

/**
 * @param {{ env?: Record<string, string | undefined>, log?: { warn: (...args: unknown[]) => void } }} [deps]
 */
export const validateEnvOrDie = (deps = {}) => {
  const env = deps.env ?? process.env;
  // 테스트 환경에선 log 주입 X → console.warn 으로 떨어져도 무해. 운영은 pino 주입.
  const log = deps.log ?? { warn: () => {} };

  const nodeEnv = env.NODE_ENV;
  // auth-api 만 SMTP 발송 책임 — 비번 재설정 / 이메일 인증 / 학교 인증 메일.
  const allowDisabled = env.MAILER_DISABLED_ALLOWED === 'true';
  const warnings = [
    ...validateJwtSecret(env.JWT_SECRET, { env: nodeEnv }),
    ...validateSmtpConfig(
      {
        host: env.SMTP_HOST,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      { env: nodeEnv, mailerDisabledAllowed: allowDisabled },
    ),
  ];
  for (const w of warnings) log.warn({ env: 'validation' }, w);
};

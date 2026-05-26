/**
 * 환경 변수 검증 — boot 시 fail-fast.
 *
 * 운영 환경 (NODE_ENV=production) 에서 필수 secret 가 누락되면 throw → 컨테이너가
 * 즉시 죽고 헬스체크 실패. 그 편이 "키 없이 돌다가 503 만 내뱉는" 상태보다 명확하다.
 *
 * 비-운영 (test/development) 에서는 경고 배열만 반환 (throw 안 함) — 로컬 dev 가
 * 키 없이도 검색 라우터의 503 분기를 dogfood 할 수 있어야 함.
 *
 * 비밀값 자체는 절대 메시지/로그에 노출하지 않는다. "이름"과 "결손 사유" 만 흘림.
 *
 * Issue #575: JWT_SECRET 부분은 `@getit/env-validator` 의 공통 validator 로 위임 —
 * 5 BE 가 동일 placeholder 정책을 공유. shelf 만의 KAKAO_BOOK_API_KEY 검사는 유지.
 */
import { validateJwtSecret } from '@getit/env-validator';

/** dummy placeholder 패턴 — KAKAO 키 검사 전용 (JWT 는 공통 validator 가 처리). */
const DUMMY_PATTERNS = [/^change-me/i, /^your-/i, /^xxx+$/i, /^todo$/i, /^dummy$/i];

/**
 * 값이 의미 있는 secret 인지. null/공백/dummy placeholder 면 false.
 *
 * @param {string | undefined} v
 * @returns {boolean}
 */
const isUsableSecret = (v) => {
  if (typeof v !== 'string') return false;
  const trimmed = v.trim();
  if (trimmed.length === 0) return false;
  return !DUMMY_PATTERNS.some((re) => re.test(trimmed));
};

/**
 * env 객체 검증 — production 에선 throw, 그 외엔 warnings 배열 반환.
 *
 * 호출부:
 *   - server.js 에서 boot 시점에 1회 (`process.env` 그대로 패스)
 *   - 테스트에서 임의 env 객체 패스해 회귀 가드
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string[]} warnings (production 에선 throw 되므로 비어있음)
 * @throws {Error} production 에서 필수 값 누락 시
 */
export const validateEnv = (env) => {
  const isProd = env.NODE_ENV === 'production';
  /** @type {string[]} */
  const warnings = [];

  // JWT_SECRET — 공통 validator 로 위임. production placeholder/누락 시 여기서 throw.
  warnings.push(...validateJwtSecret(env.JWT_SECRET, { env: env.NODE_ENV }));

  // KAKAO_BOOK_API_KEY — 운영에선 필수. 없으면 검색 라우터 503 만 뱉음.
  if (!isUsableSecret(env.KAKAO_BOOK_API_KEY)) {
    const msg = 'KAKAO_BOOK_API_KEY is missing or placeholder — set in infra/.env.prod';
    if (isProd) {
      throw new Error(`env validation failed:\n  - ${msg}`);
    }
    warnings.push(msg);
  }

  return warnings;
};

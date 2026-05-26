/**
 * JWT_SECRET placeholder / 길이 검증 (Issue #575).
 *
 * 길이만 보는 기존 가드는 \`.env.prod.example\` 의 known placeholder
 * (\`change-me-min-32-chars-long-aaaaaaaaaaaaa\`) 가 32+ 자라 그대로 통과한다 —
 * 운영자가 example 복사해서 그대로 쓰면 모든 토큰이 public secret 으로 서명됨.
 *
 * 본 validator 는:
 *   1. 빈/공백 → throw
 *   2. 32자 미만 → throw
 *   3. production 에선 known placeholder 패턴 또는 example 값 정확 일치 → throw
 *   4. dev/test 에선 위 3 가지를 warning 으로 격하 (로컬 개발 편의)
 *
 * 비밀값 자체는 메시지/로그에 노출하지 않는다.
 */

import { looksLikeSecretPlaceholder } from './placeholderPatterns.js';

/**
 * \`.env.prod.example\` 에 박혀있는 정확한 placeholder 값 (이 한 줄은 deliberately
 * known — 운영에 새는 걸 잡기 위한 sentinel). 패턴 검사
 * (\`looksLikeSecretPlaceholder\`) 와 병행한다.
 */
const KNOWN_EXAMPLE_VALUES = new Set([
  'change-me-min-32-chars-long-aaaaaaaaaaaaa',
  '__REPLACE_WITH_openssl_rand_base64_48__',
]);

/**
 * 값이 명백한 placeholder 인지. JWT/SMTP 공통 정책 (`placeholderPatterns.js`) 위임.
 *
 * @param {string} v
 * @returns {boolean}
 */
const looksLikePlaceholder = (v) => {
  if (KNOWN_EXAMPLE_VALUES.has(v)) return true;
  return looksLikeSecretPlaceholder(v);
};

/**
 * JWT_SECRET 검증.
 *
 * @param {string | undefined | null} value — \`process.env.JWT_SECRET\` 그대로 패스.
 * @param {{ env?: string | undefined }} [opts] — \`env: process.env.NODE_ENV\`.
 * @returns {string[]} warnings — non-production 에서만 채워질 수 있음.
 * @throws {Error} production 에서 길이 부족 또는 placeholder.
 */
export const validateJwtSecret = (value, opts = {}) => {
  // env 비교는 정규화 후 — 'Production' / ' production ' 같은 배포 변수 노이즈가
  // production 보호를 우회하지 못하도록 (CR #579).
  const normalizedEnv = typeof opts.env === 'string' ? opts.env.trim().toLowerCase() : '';
  const isProd = normalizedEnv === 'production';
  /** @type {string[]} */
  const warnings = [];

  const trimmed = typeof value === 'string' ? value.trim() : '';

  if (trimmed.length === 0) {
    const msg = 'JWT_SECRET is required (non-empty).';
    if (isProd) throw new Error(msg);
    warnings.push(msg);
    return warnings;
  }

  if (trimmed.length < 32) {
    const msg = 'JWT_SECRET must be at least 32 characters.';
    // dev/test 는 warn (gemini #579: dev 편의를 위해 짧은 secret 허용 — 빈 값과의
    // 비일관성 해소). production 은 throw — brute force 방어.
    if (isProd) throw new Error(msg);
    warnings.push(msg);
    return warnings;
  }

  if (looksLikePlaceholder(trimmed)) {
    const msg =
      'JWT_SECRET looks like a placeholder/example value. ' +
      'Generate a real secret with: openssl rand -base64 48';
    if (isProd) throw new Error(msg);
    warnings.push(msg);
  }

  return warnings;
};

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

/**
 * \`.env.prod.example\` 에 박혀있는 정확한 placeholder 값 (이 한 줄은 deliberately
 * known — 운영에 새는 걸 잡기 위한 sentinel). 다른 파일에서 갱신될 수 있으므로
 * 패턴 검사 (\`WEAK_PATTERNS\`) 와 병행한다.
 */
const KNOWN_EXAMPLE_VALUES = new Set([
  'change-me-min-32-chars-long-aaaaaaaaaaaaa',
  '__REPLACE_WITH_openssl_rand_base64_48__',
]);

/**
 * placeholder 휴리스틱. \`.env.example\` 류에서 자주 쓰이는 표현을 통째로 거름.
 *
 * 길이 32+ 라도 본 패턴 중 하나라도 매치되면 placeholder 로 간주.
 */
const WEAK_PATTERNS = [
  /change-?me/i,
  /please-?change/i,
  /^your-/i,
  /example/i,
  /placeholder/i,
  /replace[-_ ]?with/i,
  /__REPLACE/i,
  /^todo$/i,
  /^dummy$/i,
  /^xxx+$/i,
];

/**
 * 값이 명백한 placeholder 인지.
 *
 * @param {string} v
 * @returns {boolean}
 */
const looksLikePlaceholder = (v) => {
  if (KNOWN_EXAMPLE_VALUES.has(v)) return true;
  return WEAK_PATTERNS.some((re) => re.test(v));
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
  const isProd = opts.env === 'production';
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
    // 길이는 비밀에 비례하므로 항상 throw — 32 미만이면 dev 라도 brute force 위험.
    throw new Error('JWT_SECRET must be at least 32 characters.');
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

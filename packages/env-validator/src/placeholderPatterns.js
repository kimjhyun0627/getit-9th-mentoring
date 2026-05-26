/**
 * 공통 placeholder 휴리스틱 (Issue #575, CR #579 round 2).
 *
 * \`.env.prod.example\` 의 placeholder 값들이 운영 secret/host 로 그대로 새는
 * 사고를 막기 위한 공통 정책. \`validateJwtSecret\` 와 \`validateSmtpConfig\` 가
 * 동일한 weak-pattern set 을 공유하도록 한 곳에 모음 — CR 가 지적한
 * "JWT 와 SMTP 가 같은 placeholder 정책을 써야 한다" 일관성 요구를 코드로 보장.
 *
 * 단 host 검사는 `example` 단어가 자연스럽게 들어가는 hostname 도 있어서
 * 도메인 형태(`example.com$`) 로만 매치한다 — JWT secret 은 `example` 어디에
 * 있든 placeholder 로 본다. host 전용 패턴은 `HOST_WEAK_PATTERNS` 로 별도 노출.
 */

/**
 * JWT secret / generic secret 용 placeholder 패턴.
 * `example` 단어가 어디에 있든 placeholder 로 간주 (32+ 길이라도).
 */
export const SECRET_WEAK_PATTERNS = Object.freeze([
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
]);

/**
 * SMTP_HOST 용 placeholder 패턴. hostname 도메인 형태로만 `example` 매치 —
 * `examplecorp.smtp` 같은 합법 사용을 보호하면서 RFC 2606 `example.com` 은 차단.
 */
export const HOST_WEAK_PATTERNS = Object.freeze([
  /__REPLACE/i,
  /change-?me/i,
  /please-?change/i,
  /^your-/i,
  /example\.com$/i,
  /placeholder/i,
  /replace[-_ ]?with/i,
]);

/**
 * 값이 secret-grade placeholder 인지.
 *
 * @param {string} v — 이미 trim 된 값.
 * @returns {boolean}
 */
export const looksLikeSecretPlaceholder = (v) => SECRET_WEAK_PATTERNS.some((re) => re.test(v));

/**
 * 값이 host-grade placeholder 인지.
 *
 * @param {string} host — 이미 trim 된 값.
 * @returns {boolean}
 */
export const looksLikeHostPlaceholder = (host) => HOST_WEAK_PATTERNS.some((re) => re.test(host));

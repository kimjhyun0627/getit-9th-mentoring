/**
 * safeRedirect — 오픈 리다이렉트 방어 헬퍼 (school-auth #540 / sub-issue #540).
 *
 * 6 web (`landing` / `auth-web` / `hobby-web` / `shelf-web` / `board-web` / `letter-web`)
 * 의 `?redirect=` 처리 공용 진입점. 외부에서 흘러들어온 redirect 값을 그대로
 * `window.location` 에 넣으면 phishing 사이트로 끌고 갈 수 있으니 (open redirect),
 * allowlist 통과한 값만 그대로 사용하고 나머지는 안전 디폴트로 대체한다.
 *
 * 정책 (PRD .claude/projects/school-auth.md "?redirect= 보안 정책" 섹션 단일 출처):
 *   1. 입력값 typeof 'string' 확인 + URL 디코딩 시도.
 *   2. `new URL(value)` 파싱 — base 인자 없음. relative URL 은 throw → reject.
 *   3. `url.protocol` 이 `http:` / `https:` 만 허용.
 *   4. `url.host.toLowerCase()` 가 다음 중 하나면 허용:
 *      - `get-it.cloud` (정확 매치)
 *      - `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.get-it\.cloud$` (1레벨 서브도메인,
 *         DNS-compliant label).
 *      label 길이 2자 이상 — `[a-z0-9](?:...{0,61}[a-z0-9])?` 가 single-char 도 허용하지만
 *      RFC 1035 컨벤션 따라 양 끝 alphanumeric 강제.
 *   5. 매치 실패 시 `safeDefault` (호출자 인자) 또는 `https://get-it.cloud` 로 폴백.
 *      safeDefault 자체가 invalid 면 hard-coded `https://get-it.cloud`.
 *
 * 의도적으로 base 인자를 안 줘서 relative URL ("/me", "//evil.com") 도 throw 시킴.
 * implicit fallback 차단해 attacker 가 protocol-relative 트릭으로 빠져나가지 못하게.
 *
 * @param {unknown} rawRedirect 외부에서 받은 redirect 값 (?redirect= 쿼리, sessionStorage 등)
 * @param {string} [safeDefault='https://get-it.cloud'] 거부 시 폴백 URL
 * @returns {string} 안전한 absolute URL (항상 string, 항상 http(s) 스킴 + allowlist host)
 */
// new URL(...).toString() 이 root path 를 항상 '/' 로 정규화하므로 hard-coded default 도 동일 포맷.
const HARD_CODED_DEFAULT = 'https://get-it.cloud/';
const ROOT_DOMAIN = 'get-it.cloud';
const SUBDOMAIN_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * @param {string} host
 * @returns {boolean}
 */
const isAllowedHost = (host) => {
  if (host === ROOT_DOMAIN) return true;
  // *.get-it.cloud — 정확히 1 레벨 서브도메인만.
  const suffix = `.${ROOT_DOMAIN}`;
  if (!host.endsWith(suffix)) return false;
  const label = host.slice(0, -suffix.length);
  if (!label) return false;
  if (label.includes('.')) return false; // 다중 레벨 거부
  return SUBDOMAIN_LABEL_RE.test(label);
};

/**
 * 단일 URL 후보를 검증해 안전하면 그대로 반환, 아니면 null.
 *
 * @param {unknown} candidate
 * @returns {string | null}
 */
const validate = (candidate) => {
  if (typeof candidate !== 'string' || candidate.length === 0) return null;
  // URL 디코딩 시도 — 호출자가 미리 decode 했어도 두 번 decode 가 안전한 케이스 (단순 영숫자/슬래시)
  // 가 대부분이라 허용. 실패하면 raw 그대로 사용.
  let decoded = candidate;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    // malformed escape — raw 그대로 진행. 어차피 URL 파싱이 다음 단계.
  }
  let url;
  try {
    url = new URL(decoded);
  } catch {
    return null;
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
  const host = url.host.toLowerCase();
  if (!isAllowedHost(host)) return null;
  // host 정규화한 결과로 다시 직렬화 — 대문자 입력을 lowercase 로 통일.
  url.host = host;
  return url.toString();
};

/**
 * @param {unknown} rawRedirect
 * @param {string} [safeDefault]
 * @returns {string}
 */
export const safeRedirect = (rawRedirect, safeDefault = HARD_CODED_DEFAULT) => {
  const primary = validate(rawRedirect);
  if (primary !== null) return primary;
  const fallback = validate(safeDefault);
  if (fallback !== null) return fallback;
  return HARD_CODED_DEFAULT;
};

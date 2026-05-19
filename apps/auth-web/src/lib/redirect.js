/**
 * SSO 로그인/회원가입 후 redirect 처리 헬퍼.
 *
 * 규칙:
 *  - ?redirect= 파라미터가 있고 안전한 호스트면 그 URL로 window.location.replace
 *  - 안전 호스트: *.get-it.cloud / get-it.cloud / 현재 origin (상대 경로도 허용)
 *  - 그 외는 fallback (`/`) 으로 이동
 *
 * 이렇게 화이트리스트하는 이유: open redirect 취약점 회피.
 *
 * @param {URLSearchParams} searchParams
 * @param {string} [fallback]
 */
export const redirectAfterAuth = (searchParams, fallback = '/') => {
  const raw = searchParams.get('redirect');
  const target = raw ? safeTarget(raw, fallback) : fallback;
  if (typeof window !== 'undefined') {
    window.location.replace(target);
  }
};

/**
 * 입력 URL이 화이트리스트면 원본 raw 그대로, 아니면 fallback.
 *
 * URL.toString() 은 자동으로 trailing slash 를 추가/정규화하므로,
 * 호스트만 검증한 뒤 원본 raw 문자열을 그대로 반환해 사용자가 떠난 경로를
 * 정확히 보존한다.
 *
 * @param {string} raw
 * @param {string} fallback
 * @returns {string}
 */
const safeTarget = (raw, fallback) => {
  // 상대 경로는 허용 (절대 origin 이 아니어야)
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname;
    const ok =
      host === 'get-it.cloud' ||
      host.endsWith('.get-it.cloud') ||
      (typeof window !== 'undefined' && host === window.location.hostname);
    return ok ? raw : fallback;
  } catch {
    return fallback;
  }
};

/**
 * POST auth.get-it.cloud/api/logout — cross-domain cookie revoke (#343 / #246).
 *
 * `/api/logout` 은 auth-api csrf guard 면제 라우트 (다른 web 앱이 토큰 없이 호출
 * 가능하도록 의도, `lib/csrf.js` 주석 참고). 따라서 landing 에서 CSRF prefetch
 * 없이 바로 POST 가능.
 *
 * 성공/실패 무관하게 페이지 새로고침으로 헤더 세션 상태를 재조회 → flicker 없는
 * "logout 후 sign-in 표시" 전환. 실패 시에도 새로고침으로 retry 가능.
 *
 * 별도 모듈로 분리한 이유: Header.jsx 에서 같은 파일에 두면 vite/react-refresh
 * 경고 (Fast refresh only works when a file only exports components).
 *
 * CR feedback (#351): fetch 가 무한 hang 하면 finally 의 reload 가 실행되지 않음.
 * AbortController + 3s 타임아웃으로 강제 abort → catch 경로로 finally 진입 보장.
 *
 * @returns {Promise<void>}
 */
const AUTH_ORIGIN = import.meta.env.VITE_AUTH_ORIGIN || 'https://auth.get-it.cloud';
const LOGOUT_TIMEOUT_MS = 3000;

export const performLogout = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);
  try {
    await fetch(`${AUTH_ORIGIN}/api/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch {
    // 네트워크 에러/abort 도 fail-soft — 새로고침으로 상태 재조회.
  } finally {
    clearTimeout(timer);
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  }
};

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
 * @returns {Promise<void>}
 */
const AUTH_ORIGIN = import.meta.env.VITE_AUTH_ORIGIN || 'https://auth.get-it.cloud';

export const performLogout = async () => {
  try {
    await fetch(`${AUTH_ORIGIN}/api/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  } catch {
    // 네트워크 에러도 fail-soft — 새로고침으로 상태 재조회.
  } finally {
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  }
};

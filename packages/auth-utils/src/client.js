/**
 * FE에서 사용하는 SSO 도우미. JWT는 HttpOnly 쿠키라 JS에서 직접 못 읽음.
 * 대신 /api/me 핑으로 로그인 상태 확인 + auth.get-it.cloud로 리다이렉트.
 */

/**
 * 로그인 페이지로 리다이렉트. 로그인 후 원래 페이지로 돌아오게 ?redirect= 부착.
 *
 * @param {string} authOrigin 예: 'https://auth.get-it.cloud'
 */
export const redirectToLogin = (authOrigin) => {
  if (typeof window === 'undefined') return;
  const back = encodeURIComponent(window.location.href);
  window.location.href = `${authOrigin}/login?redirect=${back}`;
};

/**
 * 로그아웃 — auth-api/logout 호출 + 로그인 페이지로.
 *
 * @param {string} authOrigin
 */
export const logout = async (authOrigin) => {
  await fetch(`${authOrigin}/api/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  redirectToLogin(authOrigin);
};

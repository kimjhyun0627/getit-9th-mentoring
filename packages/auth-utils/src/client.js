/**
 * FE에서 사용하는 SSO 도우미. JWT는 HttpOnly 쿠키라 JS에서 직접 못 읽음.
 * 대신 /api/me 핑으로 로그인 상태 확인 + auth.get-it.cloud로 리다이렉트.
 *
 * + 4 BE-web 공유 silent refresh interceptor (Issue #241).
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

/**
 * Silent refresh interceptor 를 axios 인스턴스에 설치 (Issue #241).
 *
 * 동작:
 *   - 응답이 401 + 재시도 안 한 요청이면, `POST {authOrigin}/api/refresh` 1회 호출.
 *   - 동시 401 여러 개일 때 single-flight (race 방지 — 첫 번째 호출만 실제 refresh,
 *     나머지는 같은 promise 를 기다림).
 *   - refresh 성공 → 원 요청 retry (`config._retry=true` 마크로 무한 루프 방지).
 *   - refresh 실패 → onUnauthorized 콜백 (기본은 redirectToLogin).
 *   - refresh 요청 자체의 401 은 retry 안 함.
 *
 * 사용:
 *   ```js
 *   import axios from 'axios';
 *   import { installSilentRefresh } from '@getit/auth-utils/client';
 *   const api = axios.create({ baseURL: '/api', withCredentials: true });
 *   installSilentRefresh(api, { authOrigin: 'https://auth.get-it.cloud' });
 *   ```
 *
 * @param {import('axios').AxiosInstance} axiosInstance
 * @param {{
 *   authOrigin: string,
 *   onUnauthorized?: () => void,
 *   refreshPath?: string,
 * }} opts
 * @returns {() => void} cleanup — 인터셉터 제거 함수 (테스트용)
 */
export const installSilentRefresh = (axiosInstance, opts) => {
  if (!axiosInstance || typeof axiosInstance.interceptors?.response?.use !== 'function') {
    throw new Error('installSilentRefresh: invalid axios instance');
  }
  if (!opts || typeof opts.authOrigin !== 'string' || !opts.authOrigin) {
    throw new Error('installSilentRefresh: opts.authOrigin required');
  }

  const refreshPath = opts.refreshPath ?? '/api/refresh';
  const refreshUrl = `${opts.authOrigin}${refreshPath}`;
  const fallback = opts.onUnauthorized ?? (() => redirectToLogin(opts.authOrigin));

  /** @type {Promise<void> | null} 진행중인 refresh promise — single-flight */
  let inflight = null;

  const refreshOnce = () => {
    if (!inflight) {
      inflight = (async () => {
        try {
          // axios 본체를 안 쓰고 fetch 사용: refresh 자체 401 이 인터셉터를
          // 재트리거하는 것을 피함.
          const res = await fetch(refreshUrl, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
        } finally {
          // 다음 401 사이클을 위해 inflight 를 microtask 경계 이후에 비움.
          queueMicrotask(() => {
            inflight = null;
          });
        }
      })();
    }
    return inflight;
  };

  const id = axiosInstance.interceptors.response.use(
    (res) => res,
    async (err) => {
      const status = err?.response?.status;
      const original = err?.config;
      const url = typeof original?.url === 'string' ? original.url : '';
      // refresh path 자체 호출은 retry 대상 X (무한 루프 방지).
      // 부분 문자열 match (`includes`) 대신 정확 매치 — 다른 path 와 우연 일치를 막는다.
      const isRefreshCall = url === refreshUrl || url === refreshPath || url.endsWith(refreshPath);
      if (status !== 401 || !original || original._retry || isRefreshCall) {
        return Promise.reject(err);
      }
      original._retry = true;
      try {
        await refreshOnce();
        return await axiosInstance.request(original);
      } catch {
        try {
          fallback();
        } catch {
          // fallback 이 throw 해도 원 에러 보존.
        }
        return Promise.reject(err);
      }
    },
  );

  return () => axiosInstance.interceptors.response.eject(id);
};

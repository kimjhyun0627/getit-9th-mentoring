import axios from 'axios';

/**
 * auth-web 전용 axios 인스턴스.
 * - baseURL: VITE_API_URL 우선, 없으면 '/api' (prod 동일 origin 가정)
 * - withCredentials: true — JWT는 HttpOnly 쿠키. .get-it.cloud 도메인 공유.
 */
const baseURL = import.meta.env?.VITE_API_URL ?? '/api';

export const client = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 10000,
});

/**
 * 401 시 상위 콜백 실행 (옵션). 폼 페이지에선 보통 사용 안 함.
 *
 * @type {{ onUnauthorized: (() => void) | null }}
 */
const handlers = { onUnauthorized: null };

/**
 * 401 콜백 등록.
 *
 * @param {() => void} fn
 */
export const setUnauthorizedHandler = (fn) => {
  handlers.onUnauthorized = fn;
};

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && handlers.onUnauthorized) {
      handlers.onUnauthorized();
    }
    return Promise.reject(err);
  },
);

/**
 * 명시적 헬퍼 — 페이지에서 직접 axios 노출하지 않고 이 객체만 import 하도록.
 */
export const api = {
  /**
   * @param {{ email: string; password: string }} body
   */
  login: (body) => client.post('/login', body),
  /**
   * @param {{ name: string; email: string; password: string; passwordConfirm: string }} body
   */
  signup: (body) => client.post('/signup', body),
  me: () => client.get('/me'),
  logout: () => client.post('/logout'),
  /**
   * 비밀번호 재설정 토큰 발급 요청 (Issue #221).
   * BE 는 enumeration 차단을 위해 항상 200 응답.
   *
   * @param {{ email: string }} body
   */
  forgotPassword: (body) => client.post('/password/forgot', body),
  /**
   * 비밀번호 재설정 확정 (Issue #221).
   *
   * @param {{ token: string; password: string; passwordConfirm: string }} body
   */
  resetPassword: (body) => client.post('/password/reset', body),
};

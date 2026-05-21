/**
 * hobby-web 공용 axios 인스턴스 + 401 refresh interceptor.
 *
 * 분리 이유: 도메인별 API 모듈 (posts/applications/notifications/me) 이 같은
 * `client` 를 공유해야 하므로, 인스턴스 생성 + interceptor 등록을 한 곳에 둔다.
 *
 * `authClient` 는 `/api/me` 만 쓰는 별도 instance (auth-api 도메인). interceptor
 * 는 동일하지만 baseURL 이 다르므로 makeOnError 를 instance 별로 새로 만든다.
 */
import axios from 'axios';

import { onSuccess } from './api.helpers.js';
import { makeOnError, refreshAccessToken } from './api.refresh.js';

// re-export — 기존 외부 호출자 호환 (api.js 가 이 심볼을 다시 re-export 한다).
export { refreshAccessToken };

/**
 * hobby-web 전용 axios 인스턴스.
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
 * 401 시 상위 콜백 실행 (옵션). 작성 페이지에서 unauthorized 처리 용.
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

client.interceptors.response.use(onSuccess, makeOnError(client, handlers));

/**
 * auth-api 와 통신할 axios 인스턴스. VITE_AUTH_API_URL 우선,
 * 없으면 hobby-api 와 동일 origin (`/api`) 가정 (Traefik path-based routing 시).
 */
const authBaseURL = import.meta.env?.VITE_AUTH_API_URL ?? '/api';
export const authClient = axios.create({
  baseURL: authBaseURL,
  withCredentials: true,
  timeout: 10000,
});

// `client` 와 동일 interceptor 적용 — getMe 등 auth 요청도 BE-down 시 fail-soft
// + 401 시 refresh + 재시도. 단 instance 가 다르므로 makeOnError 로 새로 만든다.
authClient.interceptors.response.use(onSuccess, makeOnError(authClient, handlers));

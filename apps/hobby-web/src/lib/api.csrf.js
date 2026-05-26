/**
 * auth-api CSRF double-submit 토큰 helper — #573.
 *
 * 배경:
 *  - hobby-web 의 `authClient` 는 그동안 `GET /api/me` 만 호출해서 CSRF 가 필요 없었다.
 *  - #573 에서 `PATCH /api/me/student-id` (auth-api) 가 추가되면서 처음으로 상태변경
 *    호출이 생긴다. auth-api 의 csrfGuard 가 `/api/me/*` 를 보호하므로 hobby-web 도
 *    `X-CSRF-Token` 헤더를 보내야 한다.
 *
 * 동작:
 *  - mount 시점 prefetch 없음. 첫 상태변경 요청 직전에 lazy 로 `GET /api/csrf` 1회.
 *  - 응답 body 의 `token` 을 메모리에 캐싱 + 쿠키(getit_csrf, getit_csrf_pub)도 자동 셋
 *    (`.get-it.cloud` 도메인 공유, `withCredentials: true`).
 *  - 403 + `Csrf*` 에러 응답 → 캐시 무효화 → 다음 요청에서 재발급 (서버 재시작 등 회복).
 *
 * 분리 이유:
 *  - auth-web 의 api.js (#312) 패턴을 차용했지만 hobby-web 은 api.core.js 가 이미
 *    300줄 cap 안에 있어 더 키우지 않는다. interceptor 도 한 곳에서만 등록.
 */

/** @type {string | null} */
let csrfToken = null;

/**
 * Single-flight in-flight promise — 동시 첫 요청이 GET /csrf 를 한 번만 보낸다.
 *
 * 배경 (Gemini #580 medium): 첫 PATCH/DELETE 가 동시에 여러 발사되면 각각이
 * `ensureCsrfToken` 을 호출 → 동시 GET /csrf → BE 가 매 요청마다 새 토큰 발급 시
 * 마지막 토큰만 쿠키에 남고 나머지 요청은 mismatch 로 403. 단일 비행 promise 를
 * 공유해 한 번만 발사 (api.refresh.js 의 refreshInFlight 패턴과 동일 원리).
 *
 * @type {Promise<string | null> | null}
 */
let csrfPromise = null;

/**
 * 캐시 무효화 — 다음 요청에서 강제 재발급. 403 CsrfTokenMismatch/Invalid 응답 시 호출.
 *
 * CR #580 (major): in-flight `csrfPromise` 는 건드리지 않는다. 진행 중인 GET /csrf
 * 가 있는데 이를 nullify 하면 동시 in-flight 호출자들이 새 GET 을 발사 → race.
 * promise 자체는 ensureCsrfToken 의 finally 가 정리하므로 여기서는 token 만 비운다.
 */
export const clearCsrfTokenCache = () => {
  csrfToken = null;
};

/**
 * `GET /api/csrf` 1회 호출 → 토큰 캐시. 실패해도 swallow — null 반환 시 호출자가
 * 헤더 없이 요청을 보내고 BE 가 403 으로 거부하게 둔다 (조용한 실패 방지).
 *
 * 동시 호출 시: 첫 호출만 실제 GET, 나머지는 동일 promise 를 await — single-flight.
 *
 * @param {import('axios').AxiosInstance} instance - auth-api 도메인 axios
 * @returns {Promise<string | null>}
 */
export const ensureCsrfToken = (instance) => {
  if (csrfToken) return Promise.resolve(csrfToken);
  if (csrfPromise) return csrfPromise;
  csrfPromise = (async () => {
    try {
      const { data } = await instance.get('/csrf');
      csrfToken = typeof data?.token === 'string' && data.token.length > 0 ? data.token : null;
      return csrfToken;
    } catch {
      return null;
    } finally {
      // 성공/실패 무관하게 in-flight 해제. 실패 시 다음 호출이 즉시 재시도 가능.
      csrfPromise = null;
    }
  })();
  return csrfPromise;
};

/**
 * axios request interceptor — 상태변경 메서드일 때 `X-CSRF-Token` 자동 첨부.
 *
 *  - `/csrf` 자체는 GET 이라 헤더 불필요. 그래도 method 가드로 한 번 더 안전.
 *  - GET/HEAD/OPTIONS 는 token fetch 도 skip (불필요한 라운드트립 차단).
 *
 * @param {import('axios').AxiosInstance} instance
 * @returns {(config: import('axios').InternalAxiosRequestConfig) => Promise<import('axios').InternalAxiosRequestConfig>}
 */
export const makeCsrfRequestInterceptor = (instance) => async (config) => {
  const method = String(config.method ?? 'get').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return config;
  const t = await ensureCsrfToken(instance);
  if (t) {
    config.headers = config.headers ?? {};
    config.headers['X-CSRF-Token'] = t;
  }
  return config;
};

/**
 * axios response error interceptor — 403 Csrf* 응답이면 캐시 무효화.
 * 재시도는 하지 않음 (호출자가 재시도 정책 가짐). 다음 요청부터 정상 발급.
 *
 * @param {unknown} err
 * @returns {Promise<never>}
 */
export const onCsrfError = (err) => {
  const axiosErr = /** @type {{ response?: { status?: number, data?: { error?: string } } }} */ (
    err
  );
  const status = axiosErr?.response?.status;
  const code = axiosErr?.response?.data?.error;
  if (status === 403 && typeof code === 'string' && code.startsWith('Csrf')) {
    clearCsrfTokenCache();
  }
  return Promise.reject(err);
};

/**
 * 테스트 전용 — 모듈 캐시 상태 완전 초기화 (token + in-flight promise).
 */
export const __resetCsrfForTest = () => {
  csrfToken = null;
  csrfPromise = null;
};

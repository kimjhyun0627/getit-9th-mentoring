/**
 * hobby-web api 헬퍼 — interceptor / param 빌더 / shape assertion.
 * 분리 이유: api.js 가 300줄 cap 안에 들어가도록.
 */

/**
 * 응답 본체가 진짜 JSON 형태인지 확인.
 *
 * BE 미기동 시 vite dev server 가 SPA fallback 으로 `/api/*` 요청에
 * `index.html` (HTML 문자열) 을 status 200 으로 응답하는 케이스 (#89).
 * axios 는 그대로 통과시켜 `res.data` 가 문자열이 되고, 이후 dereference 로 React unmount.
 *
 * axios 1.x 는 응답 헤더 키를 소문자로 정규화하므로 `content-type` 만 본다.
 *
 * @param {unknown} data
 * @param {Record<string, string> | undefined} headers
 */
export const assertJsonObject = (data, headers) => {
  const contentType = headers?.['content-type'] ?? '';
  if (typeof contentType === 'string' && contentType.includes('text/html')) {
    throw new Error('invalid response: expected JSON, got HTML (BE down?)');
  }
  if (typeof data === 'string') {
    throw new Error('invalid response: expected JSON object, got string');
  }
  if (data === null || typeof data !== 'object') {
    throw new Error('invalid response: expected JSON object');
  }
};

/**
 * 글로벌 응답 interceptor 핸들러.
 *  - 2xx: JSON 검증 (HEAD/204 skip)
 *
 * @param {import('axios').AxiosResponse} res
 */
export const onSuccess = (res) => {
  if (res.status === 204 || res.config?.method?.toLowerCase() === 'head') return res;
  assertJsonObject(res.data, res.headers);
  return res;
};

/**
 * GET /api/posts query string 빌더.
 *
 * @param {{
 *   status?: string;
 *   tag?: string;
 *   q?: string;
 *   timeWindow?: 'all'|'today'|'week';
 *   cursor?: string;
 *   limit?: number;
 * }} params
 */
export const buildListParams = (params) => {
  const out = {};
  if (params.status) out.status = params.status;
  if (params.tag) out.tag = params.tag;
  if (params.q) out.q = params.q;
  if (params.timeWindow && params.timeWindow !== 'all') out.timeWindow = params.timeWindow;
  if (params.cursor) out.cursor = params.cursor;
  if (params.limit !== undefined) out.limit = params.limit;
  return out;
};

/**
 * 리스트 응답 shape 검증.
 *
 * @param {unknown} data
 */
export const assertListShape = (data) => {
  const d = /** @type {{ items?: unknown }} */ (data);
  if (!Array.isArray(d.items)) {
    throw new Error('invalid response: items must be an array');
  }
};

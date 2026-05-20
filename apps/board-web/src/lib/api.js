import { CardCreateInput, CardMoveInput, CardUpdateInput } from '@getit/schemas/board';
import axios from 'axios';

/**
 * board-web 전용 axios 인스턴스.
 * - baseURL: VITE_API_URL 우선, 없으면 '/api' (prod 동일 origin 가정)
 * - withCredentials: true — JWT는 HttpOnly 쿠키. `.get-it.cloud` 도메인 공유 (SSO).
 */
// `||` 사용 — `VITE_API_URL=""` (빈 문자열) 도 fallback `'/api'` 로 처리.
const baseURL = import.meta.env?.VITE_API_URL || '/api';

export const client = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 10000,
});

/**
 * 401 시 상위 콜백 실행 (옵션). 보통 auth.get-it.cloud 로 redirect.
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
 * Zod 스키마로 페이로드를 검증해 잘못된 요청이 서버까지 가지 않게 한다.
 * - 실패 시 reject 된 Promise 반환 → 호출부의 mutation onError 가 정상 동작
 * - 성공 시 parsed value (trim, default 등 정규화된 값) 반환
 *
 * @template T
 * @param {{ safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: import('zod').ZodError } }} schema
 * @param {unknown} body
 * @returns {Promise<T>}
 */
const parseOrReject = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    const err = new Error(`잘못된 요청 페이로드: ${result.error.message}`);
    err.name = 'ValidationError';
    err.issues = result.error.issues;
    return Promise.reject(err);
  }
  return Promise.resolve(result.data);
};

/**
 * board-api 호출 헬퍼.
 * - 프로젝트/멤버/컬럼: `/projects/...` 하위
 * - 카드: `/cards` 평탄 (board-api 라우팅 참조)
 * 인증은 HttpOnly 쿠키 (`withCredentials`).
 */
export const api = {
  /** 내가 멤버인 프로젝트 목록. */
  listProjects: () => client.get('/projects'),
  /**
   * 프로젝트 생성 (OWNER로 등록 + Todo/Doing/Done 컬럼 자동 생성).
   *
   * @param {{ name: string; description?: string }} body
   */
  createProject: (body) => client.post('/projects', body),
  /**
   * 프로젝트 단건 조회.
   *
   * @param {string} projectId
   */
  getProject: (projectId) => client.get(`/projects/${projectId}`),
  /**
   * 프로젝트 컬럼 목록 (order asc).
   *
   * @param {string} projectId
   */
  listColumns: (projectId) => client.get(`/projects/${projectId}/columns`),
  /**
   * 컬럼별 카드 목록 (order asc).
   *
   * @param {string} columnId
   */
  listCards: (columnId) => client.get('/cards', { params: { columnId } }),
  /**
   * 카드 생성. zod 검증을 통과한 페이로드만 서버로 보낸다.
   *
   * @param {{ columnId: string; title: string; description?: string | null; assigneeId?: string | null }} body
   */
  createCard: (body) =>
    parseOrReject(CardCreateInput, body).then((parsed) => client.post('/cards', parsed)),
  /**
   * 카드 수정 (title / description / assigneeId 중 1+).
   *
   * @param {string} cardId
   * @param {{ title?: string; description?: string | null; assigneeId?: string | null }} body
   */
  updateCard: (cardId, body) =>
    parseOrReject(CardUpdateInput, body).then((parsed) => client.patch(`/cards/${cardId}`, parsed)),
  /**
   * 카드 삭제.
   *
   * @param {string} cardId
   */
  deleteCard: (cardId) => client.delete(`/cards/${cardId}`),
  /**
   * 카드 이동 (between-keys). order 미지정 시 대상 컬럼 끝으로.
   *
   * @param {string} cardId
   * @param {{ columnId: string; order?: number }} body
   */
  moveCard: (cardId, body) =>
    parseOrReject(CardMoveInput, body).then((parsed) =>
      client.patch(`/cards/${cardId}/move`, parsed),
    ),
};
